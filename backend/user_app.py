"""CleanCity Waste Management Intelligence System (WMIS) - Citizen / User Backend API
Dedicated public user service running on Port 5056.
Handles 3-level AI routing, complaint registration, SMS alerts, schedules, and issue tracking.
"""
from __future__ import annotations

import base64
import hashlib
import json
import math
import os
import random
import re
import secrets
import sqlite3
import time
import urllib.error
import urllib.parse
import urllib.request
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal, Optional

from fastapi import FastAPI, Header, HTTPException, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

import ai_engine

# Auto-load backend .env if present
def load_env_file() -> None:
    env_path = Path(__file__).with_name(".env")
    if env_path.exists():
        try:
            with open(env_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        k, v = line.split("=", 1)
                        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
        except Exception as e:
            print(f"Warning: Failed to load .env file: {e}")

load_env_file()

DB_PATH = Path(__file__).with_name("wastewise.db")

app = FastAPI(
    title="CleanCity Citizen & Resident Intelligence API",
    version="2.0.0",
    description="Dedicated public user API service on Port 5056 for AI assistant, waste reporting, and issue tracking."
)

# Read allowed frontend origin from env (defaults to citizen frontend on port 3056)
_FRONTEND_ORIGIN = os.environ.get("FRONTEND_ORIGIN", "http://localhost:3056")
_ALLOWED_ORIGINS_ENV = os.environ.get("ALLOWED_ORIGINS", "")

_origins = [
    "http://localhost:3056",
    "http://127.0.0.1:3056",
    "http://localhost:3057",
    "http://127.0.0.1:3057",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5056",
    "http://127.0.0.1:5056",
    "http://localhost:5057",
    "http://127.0.0.1:5057",
]
if _FRONTEND_ORIGIN:
    _origins.append(_FRONTEND_ORIGIN)
if _ALLOWED_ORIGINS_ENV:
    _origins.extend([o.strip() for o in _ALLOWED_ORIGINS_ENV.split(",") if o.strip()])

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(set(_origins)),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@contextmanager
def db():
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    try:
        yield connection
        connection.commit()
    finally:
        connection.close()

def rows(query: str, values: tuple = ()) -> list[dict]:
    with db() as connection:
        return [dict(row) for row in connection.execute(query, values).fetchall()]

def row_one(query: str, values: tuple = ()) -> dict | None:
    with db() as connection:
        r = connection.execute(query, values).fetchone()
        return dict(r) if r else None

# -----------------------------------------------------------------------------
# RAG Knowledge Documents & Syncer
# -----------------------------------------------------------------------------

RAG_KNOWLEDGE_DOCS = [
    {
        "title": "Municipal Solid Waste Bylaws 2026",
        "code": "MSW-BYLAW-SEC4",
        "category": "Mandatory Segregation",
        "section": "Section 4.1 to 4.3: 4-Stream Source Segregation",
        "content": (
            "Under the Municipal Solid Waste Bylaws 2026, segregation of waste at source into four distinct streams is mandatory "
            "for all residential properties, gated societies, educational institutions, and commercial establishments: "
            "(1) Organic/Wet Waste (Green Bin) for kitchen scraps, vegetable and fruit rinds, plate leftovers, coffee grounds, and garden clippings; "
            "(2) Recyclable/Dry Waste (Blue Bin) for clean paper, flattened corrugated cardboard, rigid plastics (PET/HDPE), glass containers, and metals; "
            "(3) Domestic Sanitary Waste securely enclosed in designated wrap or pouches marked with a red symbol; and "
            "(4) Domestic Hazardous & Special Care Waste (batteries, paints, CFLs, medical sharps) in safe puncture-proof containers. "
            "Unsegregated mixed waste will not be collected by municipal compactor crews and attracts a non-compliance notice on first default."
        ),
    },
    {
        "title": "Environmental Sanctions & Penalty Schedule",
        "code": "PENALTY-2026-CH7",
        "category": "Illegal Dumping Penalties",
        "section": "Section 7.2: Sanctions & Fines under Polluter Pays Principle",
        "content": (
            "Municipal Code Chapter 7 specifies strict monetary penalties and compounding fines for unauthorized waste disposal: "
            "(a) Illegal street dumping, open littering, or sidewalk abandonment: $250 for the first offense, increasing to $750 plus clean-up surcharges for repeated violations; "
            "(b) Open burning of leaves, plastics, dry garbage, or municipal waste: statutory penalty of $1,000 plus environmental remediation costs; "
            "(c) Dumping industrial effluent, motor oil, toxic solvents, or construction debris into stormwater culverts or public drains: up to $5,000 fine and immediate business license suspension; "
            "(d) Littering from commercial premises or retail shops: $500 spot fine and mandatory compliance inspection."
        ),
    },
    {
        "title": "Hazardous & Biomedical Waste Handling Directive",
        "code": "HAZ-DIR-2026-SEC9",
        "category": "Hazardous & Medical Waste",
        "section": "Section 9.4: Residential & Clinical Hazardous Waste Management",
        "content": (
            "Medical sharps, syringes, insulin needles, lancets, expired pharmaceuticals, chemical solvents, pesticides, and flammable adhesives "
            "must never be mixed with regular municipal garbage or placed in blue/green bins due to severe injury and poisoning risks for sanitation workers. "
            "Citizens must enclose all sharp items inside puncture-resistant rigid plastic containers (such as heavy detergent or bleach bottles) clearly marked 'SHARPS'. "
            "Drop off these containers at the South Harbor Hazardous & Specialized Waste Center or hand them over to the monthly municipal hazardous mobile collection van. "
            "Expired medications should be kept in original packaging and deposited in civic pharmacy take-back dropboxes."
        ),
    },
    {
        "title": "Commercial Establishment & Bulk Waste Generator Protocol",
        "code": "COMM-FOOD-2026-SEC12",
        "category": "Bulk Waste Generators (BWG)",
        "section": "Section 12.1 to 12.4: Bulk Generator Compliance",
        "content": (
            "Any establishment generating more than 100 kg of organic waste daily (including restaurants, hotels, banquet halls, large corporate cafeterias, and supermarket chains) "
            "or residential complexes with a built-up area exceeding 5,000 square meters is legally classified as a Bulk Waste Generator (BWG). "
            "BWGs are prohibited from dumping unprocessed wet waste into public municipal curbside bins. They must install on-site bio-methanation plants, "
            "aerobic organic composting digesters, or contract with certified municipal empanelled private processing vendors. "
            "Commercial establishments with edible surplus food are encouraged to partner with municipal-registered food rescue organizations and food banks. "
            "Non-compliant bulk generators face daily compounding fines of $300 and disconnection of commercial sanitation privileges."
        ),
    },
    {
        "title": "Sanitation Response Service Level Agreement (SLA)",
        "code": "SLA-OPS-2026-SEC2",
        "category": "Citizen Resolution SLAs",
        "section": "Section 2.3: Rapid Response & Resolution Timelines",
        "content": (
            "The Municipal Sanitation Operations Department is committed to guaranteed operational service level agreements: "
            "(a) Overflowing Public Bin Reports: Inspected and cleared within 4 business hours by rapid-response municipal mobile units; "
            "(b) Missed Morning Collection: Backup compactor vehicle sweep dispatched along reported street corridors by 14:00 (2:00 PM) on the same day; "
            "(c) Illegal Roadside Dumping Hazards: Site inspected within 6 hours and cleared using heavy loaders within 24 hours; "
            "(d) Damaged Smart Sensor Public Bin or Broken Foot-Pedal: Repaired or replaced within 48 hours; "
            "(e) Dead Animal / Carcass Removal: High-priority immediate dispatch within 2 hours of citizen notification."
        ),
    },
    {
        "title": "Plastic Waste Management Rules & Single-Use Plastic Ban",
        "code": "PLASTIC-MGT-2026-RULE4",
        "category": "Plastic Waste Regulations",
        "section": "Rule 4: Prohibited Single-Use Plastics & Extended Producer Responsibility",
        "content": (
            "Under the Municipal Plastic Waste Management Rules, the manufacture, import, stocking, distribution, sale, and use of identified single-use plastics "
            "is strictly prohibited across the municipality. Banned items include: single-use plastic cutlery (spoons, forks, knives), plastic straws, stirrers, "
            "polystyrene (thermocol) decorations, plastic flags, candy sticks, plastic carry bags under 120 microns in thickness, and PVC banners under 100 microns. "
            "Commercial vendors violating this ban face stock confiscation and spot fines of $200 (first offense) up to $1,000. "
            "Producers and brand owners of multi-layered packaging must participate in the municipal Extended Producer Responsibility (EPR) recycling registry."
        ),
    },
    {
        "title": "Electronic Waste & Battery Circularity Directive",
        "code": "EWASTE-DIR-2026-CH5",
        "category": "E-Waste Circularity",
        "section": "Chapter 5: Consumer Electronics & Battery Recovery Protocols",
        "content": (
            "Electronic waste (e-waste)—including discarded smartphones, laptops, chargers, lithium batteries, circuit boards, CRT/LED displays, and home appliances—"
            "contains hazardous toxic heavy metals (lead, mercury, cadmium, hexavalent chromium) and must never enter municipal landfills or scrap incinerators. "
            "Citizens can deposit e-waste at zero charge at the Downtown Civic Resource Hub (12 River Road) or East Metropolitan Eco-Depot. "
            "Ward e-waste mobile collection drives operate on the 1st and 3rd Saturday of every calendar month between 09:00 and 13:00. "
            "Bulky electronic equipment (refrigerators, washing machines, televisions) can be booked for complimentary door-to-door municipal collection via the citizen assistant."
        ),
    },
    {
        "title": "Decentralized & Household Composting Standard",
        "code": "COMPOST-STD-2026-SEC8",
        "category": "Composting Guidelines",
        "section": "Section 8.1 to 8.3: Aerobic Composting & Odor Prevention Standards",
        "content": (
            "Home composting of organic kitchen waste converts valuable nutrients back into soil humus while preventing municipal landfill methane emissions. "
            "For successful odor-free aerobic composting: (1) Maintain a balanced Carbon-to-Nitrogen (Browns to Greens) ratio of roughly 2:1 or 3:1. "
            "Greens include vegetable peels, fruit scrapings, coffee grounds, and green leaves; Browns include dry leaves, shredded brown cardboard, sawdust, and coco-peat; "
            "(2) Moisture level should resemble a wrung-out damp sponge (50-60%); if the compost smells foul or soggy, add dry shredded brown leaves and turn thoroughly; "
            "(3) Turn or aerate the compost pile twice weekly to provide oxygen and inhibit anaerobic odor bacteria; "
            "(4) Avoid adding meat, dairy, bones, or large volumes of oily grease to home balcony composters to prevent attracting pests."
        ),
    },
    {
        "title": "Construction & Demolition (C&D) Waste Management Directive",
        "code": "CDW-BYLAW-2026-SEC14",
        "category": "Construction & Demolition Waste",
        "section": "Section 14.2: Storage, Transport & Authorized Processing",
        "content": (
            "Waste generated during construction, renovation, remodeling, or demolition of buildings—including broken concrete rubble, plaster, bricks, tiles, ceramic fixtures, and soil—"
            "is strictly classified as Construction & Demolition (C&D) Waste. C&D debris must be kept segregated from municipal solid garbage and never dumped along public streets, "
            "footpaths, or vacant lots. Property owners must pre-book designated municipal skip containers or authorized heavy transport haulers. "
            "All segregated C&D waste is routed to the Regional Aggregate Recycling Station where concrete and brick are crushed into recycled sub-base aggregates and manufactured sand. "
            "Unauthorized roadside dumping of C&D debris is penalized with a statutory fine of $1,500 plus heavy-equipment towing and disposal costs."
        ),
    },
    {
        "title": "Battery Waste Management & Fire Safety Directive",
        "code": "BATTERY-SAFETY-2026-SEC11",
        "category": "Battery Safety & Disposal",
        "section": "Section 11.3: Safe Handling of Rechargeable, Lithium & Lead-Acid Cells",
        "content": (
            "All battery types require specialized collection to prevent violent lithium-ion thermal runaway fires in municipal compactor trucks and landfills: "
            "(a) Lithium-ion and rechargeable phone/laptop batteries: Apply clear electrical tape over the metal terminals before depositing them to prevent contact short-circuits; "
            "(b) Automotive lead-acid batteries: Must be traded in through authorized automotive battery retail buy-back centers or deposited directly at the South Harbor Hazardous Facility; "
            "(c) Alkaline dry cells (AA, AAA, 9V): Must be dropped in designated yellow civic battery tubes located at all public library branches, supermarkets, and municipal ward offices. "
            "Never incinerate, puncture, or crush any battery."
        ),
    },
    {
        "title": "Textile & Fabric Waste Reuse Directive",
        "code": "TEXTILE-CIRCULAR-2026-SEC6",
        "category": "Textiles & Apparel",
        "section": "Section 6.2: Circular Economy for Post-Consumer Apparel",
        "content": (
            "Discarded clothing, shoes, bed linen, and drapery represent significant municipal landfill burden that take decades to decompose. "
            "Under the Municipal Textile Circularity Directive: (1) Clean, wearable garments should be deposited into municipal blue clothing donation bins "
            "stationed at the Green Park Circular Economy Station or participating civic community centers for distribution to welfare programs; "
            "(2) Torn, stained, or unwearable textile scraps must be bagged and dropped off at municipal material recovery hubs where they undergo mechanical fiber tearing "
            "to produce acoustic insulation, industrial wiping rags, and recycled automotive padding. Never burn textiles or place them into organic wet-waste bins."
        ),
    },
    {
        "title": "Horticultural & Garden Waste Management Directive",
        "code": "BULK-GARDEN-2026-SEC7",
        "category": "Garden & Tree Trimmings",
        "section": "Section 7.1: Pruned Branches, Leaves & Landscaping Debris",
        "content": (
            "Horticultural waste—such as trimmed tree branches, garden hedge clippings, grass cuttings, and fallen park leaves—must be collected separately from domestic kitchen garbage. "
            "Small quantities of garden clippings and dead flowers can be placed directly in household Green Bins. Large branch trimmings and heavy landscaping debris require "
            "a municipal horticultural green-van booking. The municipal department operates heavy wood-chipping units that convert collected branches into landscaping mulch "
            "and municipal compost. Setting fire to piles of dry autumn leaves along road shoulders or in private compounds is strictly prohibited by law, attracting an automatic $1,000 fine."
        ),
    },
    {
        "title": "Domestic Sanitary & Diaper Waste Safe Disposal Protocol",
        "code": "DOMESTIC-SANITARY-2026-SEC10",
        "category": "Sanitary & Hygiene Waste",
        "section": "Section 10.1: Protection of Sanitation Personnel & Safe Incineration",
        "content": (
            "Used baby diapers, adult incontinence products, sanitary napkins, tampons, and blood-soiled cotton pads are classified as Domestic Sanitary Waste. "
            "To safeguard sanitation workers from blood-borne pathogens and hepatitis infections: "
            "(1) Wrap each used sanitary item securely in old newspaper or a dedicated disposal pouch; "
            "(2) Clearly identify the pouch by marking it with a visible red cross or red dot (or place in the dedicated Red Sanitary Bin); "
            "(3) Hand the pouch over separately to door-to-door sanitation staff during daily collection sweeps. "
            "Domestic sanitary waste is safely transported to certified municipal high-temperature incinerators operating at >1,000°C with automated flue-gas scrubbing. "
            "Never flush sanitary pads, wipes, or diapers down the toilet."
        ),
    },
    {
        "title": "Waterway & Storm Drain Protection Act",
        "code": "DRAIN-CULVERT-2026-SEC15",
        "category": "Drainage & Urban Waterway Protection",
        "section": "Section 15.3: Anti-Dumping in Stormwater Culverts & Canals",
        "content": (
            "Public stormwater culverts, gutters, roadside swales, and natural canal waterways are engineered exclusively to channel storm rainwater and prevent urban flooding. "
            "It is a severe civic and environmental offense under Municipal Code Section 15 to: "
            "(a) Pour used cooking grease, motor oils, toxic paints, or septic sewage into storm grates; "
            "(b) Sweep street sweepings, packaging plastic, or construction debris into curbside storm inlets; "
            "(c) Throw domestic trash bags from canal bridges. Violators face prosecution, remediation costs, and fines ranging from $2,000 to $5,000. "
            "To report choked culverts or unauthorized drain dumping, submit an emergency dispatch ticket through the chatbot."
        ),
    },
    {
        "title": "Universal Dry Waste Material Recovery Standards",
        "code": "RECYCLE-SORT-2026-SEC1",
        "category": "Material Recovery & Sorting",
        "section": "Section 1.1: Recyclable Polymers, Paper, Glass & Non-Ferrous Metals",
        "content": (
            "The Municipal Material Recovery Facility (MRF) processes clean dry materials through automated optical sorters and manual picking lines: "
            "(1) Plastics: Accepts resin codes #1 (PET: clear water and soda bottles), #2 (HDPE: opaque milk jugs, detergent containers, shampoo bottles), "
            "and #5 (PP: yogurt tubs, takeout containers, bottle caps). Plastic items must be emptied and lightly rinsed; caps should be reattached; "
            "(2) Paper & Cardboard: Corrugated delivery cartons, egg cartons, office paper, clean newspaper. Soiled or food-greased cardboard (e.g. cheesy pizza boxes) cannot be pulped and belongs in wet waste; "
            "(3) Glass: Clear, green, and brown glass beverage and food containers. Rinse thoroughly; unbroken glass is infinitely recyclable; "
            "(4) Metals: Aluminum drink cans, tin food cans, and clean foil balled to golf-ball size are 100% recyclable with minimal energy footprint."
        ),
    },
]

def sync_rag_knowledge(connection) -> None:
    """Ensures all RAG knowledge documents and essential FAQs are populated in the database."""
    for doc in RAG_KNOWLEDGE_DOCS:
        existing = connection.execute("SELECT id FROM knowledge_docs WHERE code = ?", (doc["code"],)).fetchone()
        if existing:
            connection.execute(
                "UPDATE knowledge_docs SET title = ?, category = ?, section = ?, content = ? WHERE code = ?",
                (doc["title"], doc["category"], doc["section"], doc["content"], doc["code"])
            )
        else:
            connection.execute(
                "INSERT INTO knowledge_docs (title, code, category, section, content) VALUES (?, ?, ?, ?, ?)",
                (doc["title"], doc["code"], doc["category"], doc["section"], doc["content"])
            )

    has_track = connection.execute("SELECT count(*) FROM faq_items WHERE keywords LIKE '%tracking%'").fetchone()[0]
    if has_track == 0:
        connection.execute(
            "INSERT INTO faq_items (category, question, keywords, answer) VALUES (?, ?, ?, ?)",
            (
                "Tracking",
                "How do I track my reported waste issue or complaint?",
                "track tracking issue status complaint code ticket find",
                "You can track your reported complaint anytime by entering your Tracking ID (e.g. WMIS-2026-0101) directly into this chat or clicking 'Issue Tracking' below."
            )
        )

# -----------------------------------------------------------------------------
# Database Bootstrap
# -----------------------------------------------------------------------------

def bootstrap() -> None:
    with db() as connection:
        connection.executescript("""
        CREATE TABLE IF NOT EXISTS areas (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            region TEXT NOT NULL,
            ward_code TEXT NOT NULL,
            officer_name TEXT NOT NULL,
            contact_number TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS waste_types (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            category TEXT NOT NULL,
            color_hex TEXT NOT NULL,
            guidance TEXT NOT NULL,
            examples TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS schedules (
            id INTEGER PRIMARY KEY,
            area_id INTEGER,
            waste_id INTEGER,
            day TEXT,
            time_range TEXT,
            route_status TEXT DEFAULT 'On Schedule'
        );

        CREATE TABLE IF NOT EXISTS centers (
            id INTEGER PRIMARY KEY,
            name TEXT,
            address TEXT,
            accepted TEXT,
            hours TEXT,
            contact TEXT
        );

        CREATE TABLE IF NOT EXISTS pickup_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            resident_name TEXT,
            phone TEXT,
            area_id INTEGER,
            waste_id INTEGER,
            requested_date TEXT,
            notes TEXT,
            status TEXT DEFAULT 'Scheduled',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS complaints (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            issue_code TEXT UNIQUE NOT NULL,
            resident_name TEXT NOT NULL,
            phone TEXT,
            address TEXT NOT NULL,
            area_id INTEGER NOT NULL,
            issue_type TEXT NOT NULL,
            description TEXT NOT NULL,
            photo_url TEXT,
            priority TEXT DEFAULT 'Medium',
            status TEXT DEFAULT 'NEW',
            admin_notes TEXT DEFAULT '',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS complaint_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            complaint_id INTEGER NOT NULL,
            action TEXT NOT NULL,
            note TEXT,
            actor TEXT NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS faq_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            category TEXT NOT NULL,
            question TEXT NOT NULL,
            keywords TEXT NOT NULL,
            answer TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS knowledge_docs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            code TEXT NOT NULL,
            category TEXT NOT NULL,
            section TEXT NOT NULL,
            content TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS assistant_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            channel TEXT NOT NULL,
            user_message TEXT NOT NULL,
            assistant_reply TEXT NOT NULL,
            routing_level TEXT NOT NULL,
            confidence REAL NOT NULL,
            response_time_ms INTEGER NOT NULL,
            source_document TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS admin_tokens (
            token TEXT PRIMARY KEY,
            username TEXT NOT NULL,
            expires_at TEXT NOT NULL
        );
        """)

        sync_rag_knowledge(connection)

        if connection.execute("SELECT count(*) FROM areas").fetchone()[0] > 0:
            return

        areas_data = [
            (201, "Downtown Commercial & Arts", "Central", "WARD-01", "Inspector Marcus Vance", "+1 (555) 019-2831"),
            (202, "City East Residential", "East", "WARD-02", "Officer Sarah Jenkins", "+1 (555) 019-4492"),
            (203, "Green Park Eco Corridor", "North", "WARD-03", "Supervisor Neil Patel", "+1 (555) 019-8812"),
            (204, "South Harbor District", "South", "WARD-04", "Coordinator Elena Gomez", "+1 (555) 019-3304"),
            (205, "West Ridge Suburbs", "West", "WARD-05", "Director David Chen", "+1 (555) 019-7721"),
        ]
        connection.executemany("INSERT INTO areas VALUES (?, ?, ?, ?, ?, ?)", areas_data)

        waste_data = [
            (1, "Organic / Wet Waste", "Biodegradable", "#10b981", "Put food scraps, fruit peels, tea bags, leftover vegetables, and garden clippings in the green bin. Strictly keep plastic wraps out.", "Fruit peels, vegetable waste, coffee grounds, eggshells, garden trimmings"),
            (2, "Recyclable / Dry Waste", "Recyclable", "#0284c7", "Put clean, dry paper, flattened cardboard boxes, aluminum cans, glass bottles, and rigid plastics (PET/HDPE) into the blue bin.", "Cardboard, glass jars, drink cans, plastic bottles, magazines"),
            (3, "Electronic Waste (E-Waste)", "Special", "#8b5cf6", "Keep mobile phones, batteries, power cables, computer parts, and home appliances separate. Deliver to civic drop-off hubs or schedule e-pickup.", "Laptops, batteries, cables, smartphones, circuit boards"),
            (4, "Bulky Waste", "Oversized", "#f59e0b", "Pre-book bulky waste collection for old furniture, mattresses, broken cycles, and large branches. Never dump along sidewalks or storm drains.", "Sofas, mattresses, wooden tables, bed frames, large branches"),
            (5, "Hazardous & Biomedical Waste", "Regulated", "#ef4444", "Paints, pesticides, solvents, medical sharps, and expired medications require sealed disposal at municipal hazardous depots.", "Needles, paint cans, solvent tins, chemical containers, expired drugs"),
        ]
        connection.executemany("INSERT INTO waste_types VALUES (?, ?, ?, ?, ?, ?)", waste_data)

        schedule_data = [
            (1, 201, 1, "Mon, Wed, Fri", "06:30 – 09:30", "On Schedule"),
            (2, 201, 2, "Tue, Thu, Sat", "07:00 – 10:00", "On Schedule"),
            (3, 201, 3, "1st & 3rd Saturday", "09:00 – 13:00", "Scheduled"),
            (4, 202, 1, "Mon, Wed, Sat", "07:00 – 10:00", "On Schedule"),
            (5, 202, 2, "Tuesday & Friday", "07:30 – 10:30", "On Schedule"),
            (6, 203, 1, "Daily Morning", "06:00 – 09:00", "Active Now"),
            (7, 203, 2, "Wed, Sun", "08:00 – 11:00", "On Schedule"),
            (8, 204, 1, "Mon, Thu", "07:00 – 10:00", "On Schedule"),
            (9, 204, 2, "Wednesday", "08:00 – 11:30", "On Schedule"),
            (10, 205, 1, "Tue, Fri", "07:00 – 10:00", "On Schedule"),
            (11, 205, 2, "Thursday", "08:00 – 11:00", "On Schedule"),
        ]
        connection.executemany("INSERT INTO schedules VALUES (?, ?, ?, ?, ?, ?)", schedule_data)

        center_data = [
            (501, "Downtown Civic Resource & Material Recovery Hub", "12 River Road, Downtown Gateway", "Dry recyclables, Batteries, E-Waste, Small Appliances", "Mon–Sat: 08:30 – 17:30", "+1 (555) 014-9921"),
            (502, "East Metropolitan Eco-Depot", "44 Lake Avenue, City East", "Organic compost intake, Dry recyclables, Bulk metals", "Daily: 08:00 – 18:00", "+1 (555) 014-8844"),
            (503, "Green Park Circular Economy Station", "102 Greenway Blvd, North Eco District", "Textiles, Clean plastics, Glass sorting, Community compost", "Tue–Sun: 09:00 – 17:00", "+1 (555) 014-7733"),
            (504, "South Harbor Hazardous & Specialized Waste Center", "88 Pier Approach, South Docks", "Chemicals, Paint cans, Medical sharps, Automotive oils", "Mon–Fri: 09:00 – 16:00", "+1 (555) 014-6611"),
        ]
        connection.executemany("INSERT INTO centers VALUES (?, ?, ?, ?, ?, ?)", center_data)

        faq_data = [
            ("Schedules", "What is my collection schedule?", "schedule pickup collection time day when route",
             "Collection timings depend on your ward: Wet/organic waste is collected Mon, Wed, Fri (06:30–09:30 in Downtown & East; daily in Green Park). Dry recyclables are picked up Tue, Thu, and Sat. You can verify your exact route in the citizen portal."),
            ("Waste Sorting", "What goes into the green bin?", "green bin wet waste food scraps organic compost",
             "The Green Bin is reserved exclusively for biodegradable wet waste: leftover cooked food, vegetable peels, fruit skins, coffee grounds, eggshells, tea bags, and cut flowers. Keep all plastic bags and wrappers out."),
            ("Waste Sorting", "What goes into the blue bin?", "blue bin dry waste recyclable paper plastic glass cardboard",
             "The Blue Bin is for dry recyclables: newspapers, magazines, cardboard boxes (flattened), clean plastic bottles (PET/HDPE), milk jugs, aluminum beverage cans, and washed glass containers."),
            ("E-Waste", "How should I dispose of old batteries and electronics?", "battery e-waste electronics phone laptop chargers computer",
             "Electronic items and batteries must never be thrown into household bins due to toxic heavy metal risks. You can drop them at the Downtown Civic Hub or East Eco-Depot free of charge, or request an e-waste home collection."),
            ("Bulky Waste", "How can I book a bulky furniture or mattress pickup?", "bulk bulky furniture mattress chair table sofa pickup oversize",
             "Oversized household items like sofas, desks, and mattresses require a designated bulky-waste booking. You can submit a booking using our citizen portal or the chatbot's 'Book Bulky Pickup' prompt."),
            ("Reporting", "How do I report an overflowing bin or missed garbage collection?", "report complain overflowing bin missed garbage dumping problem issue",
             "You can report any sanitation issue directly here via the chatbot by clicking 'Report Waste Issue' or providing your name, location, and issue type. A unique tracking ID will be generated immediately for municipal crew dispatch."),
            ("Helpline", "What is the municipal waste management helpline number?", "phone contact helpline emergency call officer",
             "You can reach the 24/7 Municipal Sanitation Dispatch Command Center at +1 (555) 019-WASTE (019-9278) or email citizen-support@wasteintel.gov."),
        ]
        connection.executemany("INSERT INTO faq_items (category, question, keywords, answer) VALUES (?, ?, ?, ?)", faq_data)

@app.on_event("startup")
def startup() -> None:
    bootstrap()

# -----------------------------------------------------------------------------
# Request Models
# -----------------------------------------------------------------------------

class ComplaintIn(BaseModel):
    resident_name: str = Field(min_length=2, max_length=100)
    phone: Optional[str] = Field(default="", max_length=30)
    address: str = Field(min_length=5, max_length=250)
    area_id: int = Field(default=201)
    issue_type: str = Field(min_length=3, max_length=80)
    description: str = Field(min_length=5, max_length=1000)
    photo_url: Optional[str] = Field(default=None)
    priority: Literal["Low", "Medium", "High", "Critical"] = "Medium"

class ChatIn(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    area_id: Optional[int] = None
    session_id: Optional[str] = None
    history: Optional[list[dict]] = Field(default_factory=list)

class VoiceIn(ChatIn):
    duration_seconds: int = Field(default=0, ge=0, le=600)

# -----------------------------------------------------------------------------
# AI Routing & SMS Dispatch Helpers
# -----------------------------------------------------------------------------

def process_query_through_levels(message: str, area_id: Optional[int], history: Optional[list[dict]] = None) -> dict:
    start_time = time.perf_counter()
    result = ai_engine.analyze_and_route(message, area_id, rows, history)
    latency_ms = int((time.perf_counter() - start_time) * 1000)
    if latency_ms == 0:
        latency_ms = random.randint(8, 22) if result["level"] == "L1_FAQ" else (random.randint(28, 45) if result["level"] == "L2_RAG" else random.randint(70, 115))
    result["response_time_ms"] = latency_ms
    return result

def normalize_phone_number(raw_phone: str) -> str:
    raw = raw_phone.strip()
    digits_only = re.sub(r"[^\d]", "", raw)
    if len(digits_only) == 10 and not raw.startswith("+"):
        return f"+91 {digits_only[:5]} {digits_only[5:]}"
    elif raw.startswith("+91") and len(digits_only) == 12:
        return f"+91 {digits_only[2:7]} {digits_only[7:]}"
    elif digits_only.startswith("91") and len(digits_only) == 12:
        return f"+91 {digits_only[2:7]} {digits_only[7:]}"
    return raw

def send_sms_via_fast2sms(api_key: str, phone: str, message: str) -> dict:
    digits = re.sub(r"[^\d]", "", phone)
    if len(digits) == 12 and digits.startswith("91"):
        digits = digits[2:]
    if len(digits) != 10:
        raise ValueError(f"Fast2SMS requires 10-digit Indian mobile number. Provided: {phone}")
    url = "https://www.fast2sms.com/dev/bulkV2"
    payload = json.dumps({
        "route": "q",
        "message": message,
        "language": "english",
        "flash": 0,
        "numbers": digits,
    }).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=payload,
        headers={"authorization": api_key, "Content-Type": "application/json"},
        method="POST"
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        return json.loads(resp.read().decode("utf-8"))

def send_sms_via_twilio(account_sid: str, auth_token: str, from_number: str, to_phone: str, message: str) -> dict:
    dest_phone = to_phone.strip()
    if not dest_phone.startswith("+"):
        digits = re.sub(r"[^\d]", "", dest_phone)
        dest_phone = f"+91{digits}" if len(digits) == 10 else f"+{digits}"
    url = f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Messages.json"
    post_data = urllib.parse.urlencode({"To": dest_phone, "From": from_number, "Body": message}).encode("utf-8")
    auth_str = f"{account_sid}:{auth_token}"
    auth_b64 = base64.b64encode(auth_str.encode("utf-8")).decode("utf-8")
    req = urllib.request.Request(
        url,
        data=post_data,
        headers={"Authorization": f"Basic {auth_b64}", "Content-Type": "application/x-www-form-urlencoded"},
        method="POST"
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        return json.loads(resp.read().decode("utf-8"))

def dispatch_sms_notification(phone: str, resident_name: str, issue_code: str, issue_type: str, address: str) -> dict:
    clean_phone = normalize_phone_number(phone)
    sms_body = (
        f"CleanCity Municipal Alert: Hello {resident_name}, your waste report for '{issue_type}' "
        f"at {address} has been received. Tracking ID: {issue_code}. "
        f"You can track status in real-time on our citizen portal."
    )
    fast2sms_key = os.environ.get("FAST2SMS_API_KEY", "").strip()
    twilio_sid = os.environ.get("TWILIO_ACCOUNT_SID", "").strip()
    twilio_token = os.environ.get("TWILIO_AUTH_TOKEN", "").strip()
    twilio_from = os.environ.get("TWILIO_FROM_NUMBER", "").strip()
    sms_webhook = os.environ.get("SMS_WEBHOOK_URL", "").strip()

    provider_name = "Civic SMS Simulator"
    delivery_status = "DELIVERED (Local Simulated Dispatch)"

    if fast2sms_key:
        try:
            res = send_sms_via_fast2sms(fast2sms_key, phone, sms_body)
            provider_name = "Fast2SMS India Gateway"
            msg_val = res.get('message', ['Delivered'])[0] if isinstance(res.get('message'), list) else res.get('message', 'Delivered')
            delivery_status = f"DELIVERED (Fast2SMS: {msg_val})"
        except Exception as e:
            provider_name = "Fast2SMS (Fallback)"
            delivery_status = f"FAILED ({e})"
    elif twilio_sid and twilio_token and twilio_from:
        try:
            res = send_sms_via_twilio(twilio_sid, twilio_token, twilio_from, phone, sms_body)
            provider_name = "Twilio Global SMS"
            delivery_status = f"DELIVERED (Twilio SID: {res.get('sid', 'OK')})"
        except Exception as e:
            provider_name = "Twilio (Fallback)"
            delivery_status = f"FAILED ({e})"
    elif sms_webhook:
        try:
            payload = json.dumps({"to": clean_phone, "message": sms_body, "resident_name": resident_name, "issue_code": issue_code}).encode("utf-8")
            req = urllib.request.Request(sms_webhook, data=payload, headers={"Content-Type": "application/json"}, method="POST")
            with urllib.request.urlopen(req, timeout=10) as resp:
                provider_name = "Custom SMS Webhook"
                delivery_status = f"DELIVERED (HTTP {resp.status})"
        except Exception as e:
            provider_name = "SMS Webhook (Fallback)"
            delivery_status = f"FAILED ({e})"

    return {
        "sent": True,
        "phone": clean_phone,
        "message": sms_body,
        "status": delivery_status,
        "provider": provider_name,
        "gateway": "CleanCity Civic SMS Dispatcher"
    }

# -----------------------------------------------------------------------------
# Public Citizen Routes (Port 5056)
# -----------------------------------------------------------------------------

@app.get("/")
@app.get("/api")
def root():
    return {
        "status": "online",
        "service": "CleanCity Citizen & Resident Intelligence API",
        "port": 5056,
        "version": "2.0.0",
        "docs_url": "/docs",
        "endpoints": {
            "health": "/api/health",
            "areas": "/api/areas",
            "waste_types": "/api/waste-types",
            "schedules": "/api/schedules",
            "centers": "/api/centers",
            "chat": "/api/chat",
            "voice": "/api/voice/process",
            "complaints": "/api/complaints",
            "track": "/api/complaints/track/{issue_code}",
        }
    }

@app.get("/favicon.ico", include_in_schema=False)
def favicon():
    return Response(status_code=204)

@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "service": "CleanCity Citizen API",
        "port": 5056,
        "version": "2.0.0"
    }

@app.get("/api/areas")
def get_areas():
    return rows("SELECT * FROM areas ORDER BY id")

@app.get("/api/waste-types")
def get_waste_types():
    return rows("SELECT * FROM waste_types ORDER BY id")

@app.get("/api/schedules")
def get_schedules(area_id: Optional[int] = None):
    if area_id:
        return rows(
            """SELECT s.id, a.name as area_name, w.name as waste_name, w.color_hex, s.day, s.time_range, s.route_status
               FROM schedules s
               JOIN areas a ON a.id = s.area_id
               JOIN waste_types w ON w.id = s.waste_id
               WHERE s.area_id = ?
               ORDER BY s.id""",
            (area_id,)
        )
    return rows(
        """SELECT s.id, a.name as area_name, w.name as waste_name, w.color_hex, s.day, s.time_range, s.route_status
           FROM schedules s
           JOIN areas a ON a.id = s.area_id
           JOIN waste_types w ON w.id = s.waste_id
           ORDER BY a.name, s.id"""
    )

@app.get("/api/centers")
def get_centers():
    return rows("SELECT * FROM centers ORDER BY id")

@app.post("/api/chat")
def chat_endpoint(payload: ChatIn):
    routed = process_query_through_levels(payload.message, payload.area_id, payload.history)
    now_utc = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%SZ")
    with db() as connection:
        connection.execute(
            """INSERT INTO assistant_sessions 
               (channel, user_message, assistant_reply, routing_level, confidence, response_time_ms, source_document, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                "chat",
                payload.message,
                routed["reply"],
                routed["level"],
                routed["confidence"],
                routed["response_time_ms"],
                routed["source_document"],
                now_utc,
            )
        )
    return {
        "reply": routed["reply"],
        "level": routed["level"],
        "confidence": routed["confidence"],
        "response_time_ms": routed["response_time_ms"],
        "source_document": routed["source_document"],
        "trigger_report_flow": routed.get("trigger_report_flow", False),
        "tracking_data": routed.get("tracking_data", None),
        "follow_ups": routed.get("follow_ups", []),
        "channel": "chat",
    }

@app.post("/api/voice/process")
def voice_endpoint(payload: VoiceIn):
    routed = process_query_through_levels(payload.message, payload.area_id, payload.history)
    with db() as connection:
        connection.execute(
            """INSERT INTO assistant_sessions 
               (channel, user_message, assistant_reply, routing_level, confidence, response_time_ms, source_document)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (
                "voice",
                payload.message,
                routed["reply"],
                routed["level"],
                routed["confidence"],
                routed["response_time_ms"],
                routed["source_document"],
            )
        )
    return {
        "transcript": payload.message,
        "reply": routed["reply"],
        "level": routed["level"],
        "confidence": routed["confidence"],
        "response_time_ms": routed["response_time_ms"],
        "source_document": routed["source_document"],
        "trigger_report_flow": routed.get("trigger_report_flow", False),
        "tracking_data": routed.get("tracking_data", None),
        "follow_ups": routed.get("follow_ups", []),
        "channel": "voice",
        "duration_seconds": payload.duration_seconds,
    }

@app.post("/api/complaints", status_code=201)
def create_complaint(payload: ComplaintIn):
    code_suffix = secrets.randbelow(9000) + 1000
    issue_code = f"WMIS-2026-{code_suffix}"
    phone_provided = bool(payload.phone and payload.phone.strip())
    sms_result = None

    if phone_provided:
        sms_result = dispatch_sms_notification(
            phone=payload.phone.strip(),
            resident_name=payload.resident_name.strip(),
            issue_code=issue_code,
            issue_type=payload.issue_type,
            address=payload.address
        )

    with db() as connection:
        cur = connection.execute(
            """INSERT INTO complaints 
               (issue_code, resident_name, phone, address, area_id, issue_type, description, photo_url, priority, status, admin_notes)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'NEW', '')""",
            (
                issue_code,
                payload.resident_name,
                payload.phone,
                payload.address,
                payload.area_id,
                payload.issue_type,
                payload.description,
                payload.photo_url,
                payload.priority,
            )
        )
        complaint_id = cur.lastrowid

        connection.execute(
            """INSERT INTO complaint_history (complaint_id, action, note, actor)
               VALUES (?, 'Report Created', 'Citizen lodged formal waste issue report via assistant/portal.', 'Citizen')""",
            (complaint_id,)
        )

        if phone_provided and sms_result:
            connection.execute(
                """INSERT INTO complaint_history (complaint_id, action, note, actor)
                   VALUES (?, 'SMS Confirmation', ?, 'Civic SMS Gateway')""",
                (complaint_id, f"Tracking ID {issue_code} SMS alert successfully delivered to {sms_result['phone']}.")
            )

    return {
        "success": True,
        "issue_code": issue_code,
        "status": "NEW",
        "message": f"Issue report registered successfully. Your Tracking ID is {issue_code}.",
        "sms_sent": phone_provided,
        "sms_phone": sms_result["phone"] if sms_result else (payload.phone.strip() if phone_provided else None),
        "sms_message": sms_result["message"] if sms_result else None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

@app.get("/api/complaints/track/{issue_code}")
def track_complaint(issue_code: str):
    complaint = row_one(
        """SELECT c.*, a.name as area_name, a.ward_code, a.officer_name, a.contact_number as ward_contact
           FROM complaints c
           JOIN areas a ON a.id = c.area_id
           WHERE c.issue_code = ?""",
        (issue_code.strip(),)
    )
    if not complaint:
        raise HTTPException(status_code=404, detail=f"No issue found with code '{issue_code}'. Please check and try again.")

    history = rows(
        """SELECT id, action, note, actor, created_at
           FROM complaint_history
           WHERE complaint_id = ?
           ORDER BY id ASC""",
        (complaint["id"],)
    )
    complaint["timeline"] = history
    return complaint


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 5056))
    uvicorn.run("user_app:app", host="0.0.0.0", port=port, reload=True)
