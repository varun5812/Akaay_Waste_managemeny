"use client";

import React, { useEffect, useState } from "react";
import { fetchApi, Area } from "../lib/api";
import ChatWidget from "../components/ChatWidget";
import TrackIssueModal from "../components/TrackIssueModal";

export default function HomePage() {
  const [areas, setAreas] = useState<Area[]>([]);
  const [trackingCodeModal, setTrackingCodeModal] = useState<string | null>(null);

  useEffect(() => {
    fetchApi<Area[]>("/api/areas")
      .then((a) => setAreas(a))
      .catch((err) => console.error("Failed to fetch areas", err));
  }, []);

  return (
    <main className="pure-hero-viewport">

      {/* Fullscreen Landscape Background matching the user reference image */}
      <div className="pure-bg-wrapper">
        <img
          src="/hero-bg.jpg?v=fhd2"
          alt="Waste Management Intelligence System Landscape"
          className="pure-bg-img"
        />
      </div>

      {/* Top Left Slogan Banner (No background card, crisp typography) */}
      <div className="pure-top-left-content">
        <h1 className="hero-main-title">
          Together for a <span className="hero-title-gradient">Cleaner Tomorrow</span>
        </h1>
        <p className="hero-subtitle">
          Together for a cleaner, healthier, and brighter community
        </p>
      </div>

      {/* Compact Floating Chatbot Widget (Bottom Right) */}
      <ChatWidget
        areas={areas}
        onOpenTracker={(code) => setTrackingCodeModal(code)}
      />

      {/* Tracking Modal if triggered via Chat */}
      {trackingCodeModal !== null && (
        <TrackIssueModal
          initialCode={trackingCodeModal}
          onClose={() => setTrackingCodeModal(null)}
        />
      )}
    </main>
  );
}
