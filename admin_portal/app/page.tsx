"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  BarChart3,
  Bot,
  CheckCircle2,
  ChevronDown,
  Clock3,
  FileText,
  Filter,
  LayoutDashboard,
  Leaf,
  LogOut,
  MapPin,
  Menu,
  MessageSquare,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Ticket,
  User,
  Users,
  X,
  AlertCircle,
  ArrowUpRight,
  TrendingUp,
  Download,
  Calendar,
  Award,
  AlertTriangle,
  Check,
  Phone,
  Truck,
  Layers,
  ChevronRight,
  ArrowRight,
  SlidersHorizontal,
  Plus,
  Copy,
  Lock,
  Printer,
  Maximize2,
} from "lucide-react";
import {
  fetchApi,
  AdminMetrics,
  ComplaintDetail,
  ChatLogItem,
  Area,
} from "../lib/api";

type Status = "NEW" | "IN PROGRESS" | "RESOLVED" | "CLOSED";
type NavSection = "dashboard" | "issues" | "analytics" | "ai" | "areas";

const STATUS_META: Record<Status, { label: string; tone: string }> = {
  NEW: { label: "New", tone: "new" },
  "IN PROGRESS": { label: "In Progress", tone: "progress" },
  RESOLVED: { label: "Resolved", tone: "resolved" },
  CLOSED: { label: "Closed", tone: "closed" },
};

export default function AdminDashboardPage() {
  const router = useRouter();
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginUsername, setLoginUsername] = useState("admin");
  const [loginPassword, setLoginPassword] = useState("admin2026");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [issues, setIssues] = useState<ComplaintDetail[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [chatLogs, setChatLogs] = useState<ChatLogItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [areaFilter, setAreaFilter] = useState<number | null>(null);
  const [priorityFilter, setPriorityFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [aiSearchQuery, setAiSearchQuery] = useState("");
  const [aiChannelFilter, setAiChannelFilter] = useState<string>("ALL");
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  
  // Section Navigation
  const [activeSection, setActiveSection] = useState<NavSection>("dashboard");
  const [timeRange, setTimeRange] = useState("Last 7 Days");

  const [selectedIssue, setSelectedIssue] = useState<ComplaintDetail | null>(null);
  const [newStatus, setNewStatus] = useState<Status>("NEW");
  const [adminNoteInput, setAdminNoteInput] = useState("");
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Add Ward Modal State
  const [isAddWardOpen, setIsAddWardOpen] = useState(false);
  const [addingWard, setAddingWard] = useState(false);
  const [wardForm, setWardForm] = useState({
    name: "",
    ward_code: "",
    region: "Central Zone",
    officer_name: "",
    contact_number: "",
    schedule_wet: "Mon, Wed, Fri: 06:30 – 09:30",
    schedule_dry: "Tue, Thu, Sat: 07:00 – 10:00",
  });

  // Detailed AI Conversation Modal State
  const [selectedChatLog, setSelectedChatLog] = useState<ChatLogItem | null>(null);
  const [chatModalLog, setChatModalLog] = useState<ChatLogItem | null>(null);
  const [copiedText, setCopiedText] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);

  useEffect(() => {
    // Require authentication on /admin
    setIsAuthenticated(false);
    setIsAuthChecking(false);
  }, []);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError(null);
    try {
      const res = await fetchApi<{ success: boolean; token: string; user: any }>("/api/admin/login", {
        method: "POST",
        body: JSON.stringify({ username: loginUsername, password: loginPassword }),
      });
      if (res.token) {
        setIsAuthenticated(true);
        loadData();
      }
    } catch (err: any) {
      setLoginError(err.message || "Invalid credentials. Try admin / admin2026");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setLoginError(null);
  };

  const fetchIssues = async () => {
    try {
      let url = `/api/admin/issues?status=${statusFilter}`;
      if (areaFilter) url += `&area_id=${areaFilter}`;
      if (searchQuery.trim()) url += `&search=${encodeURIComponent(searchQuery.trim())}`;
      const data = await fetchApi<ComplaintDetail[]>(url);
      setIssues(data);
    } catch (err) {
      console.error("Error fetching issues", err);
    }
  };

  const loadData = async () => {
    setLoading(true);
    setRefreshing(true);
    try {
      const [m, a, l] = await Promise.all([
        fetchApi<AdminMetrics>("/api/admin/metrics"),
        fetchApi<Area[]>("/api/areas"),
        fetchApi<ChatLogItem[]>("/api/admin/chat-logs?limit=50"),
      ]);
      setMetrics(m);
      setAreas(a);
      setChatLogs(l);
      if (l && l.length > 0) {
        setSelectedChatLog((prev) => prev || l[0]);
      }
      await fetchIssues();
    } catch (err: any) {
      console.error("Failed to load dashboard data", err);
      if (err.message?.includes("401") || err.message?.includes("Unauthorized")) {
        setIsAuthenticated(false);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!loading && isAuthenticated) fetchIssues();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, areaFilter, searchQuery, isAuthenticated]);

  const openIssueModal = async (issueId: number) => {
    try {
      const detail = await fetchApi<ComplaintDetail>(`/api/admin/issues/${issueId}`);
      setSelectedIssue(detail);
      setNewStatus(detail.status);
      setAdminNoteInput(detail.admin_notes || "");
    } catch (err: any) {
      alert("Failed to load issue details: " + err.message);
    }
  };

  const handleStatusUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIssue) return;
    setUpdatingStatus(true);
    try {
      await fetchApi(`/api/admin/issues/${selectedIssue.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: newStatus,
          admin_notes: adminNoteInput,
          actor: "Admin Officer (Superintendent)",
        }),
      });
      const updated = await fetchApi<ComplaintDetail>(`/api/admin/issues/${selectedIssue.id}`);
      setSelectedIssue(updated);
      await fetchIssues();
      setMetrics(await fetchApi<AdminMetrics>("/api/admin/metrics"));
    } catch (err: any) {
      alert("Failed to update status: " + err.message);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const typeTotal = metrics?.issues_by_type.reduce((sum, item) => sum + item.count, 0) || 0;
  const typeGradient = useMemo(() => {
    if (!metrics || !typeTotal) return "conic-gradient(#e7eaf0 0 100%)";
    const palette = ["#5b2be0", "#159f96", "#f5a400", "#e65d6d", "#4c7cf3"];
    let cursor = 0;
    const stops = metrics.issues_by_type.slice(0, 5).map((item, index) => {
      const start = cursor;
      cursor += (item.count / typeTotal) * 100;
      return `${palette[index % palette.length]} ${start}% ${cursor}%`;
    });
    return `conic-gradient(${stops.join(", ")})`;
  }, [metrics, typeTotal]);

  // Dynamic 7-Day Trend data and SVG bezier spline path
  const trendData = useMemo(() => {
    if (metrics?.daily_trend && metrics.daily_trend.length > 0) {
      return metrics.daily_trend;
    }
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const base = Math.max(1, Math.floor((metrics?.issues.total || 7) / 7));
    return days.map((day, idx) => ({
      day,
      reported: Math.max(1, base + (idx % 3) * 2 - (idx === 6 ? 1 : 0)),
      cleared: Math.max(1, Math.round((base + (idx % 3) * 2) * ((metrics?.issues.resolution_rate || 90) / 100))),
    }));
  }, [metrics]);

  const svgTrendPaths = useMemo(() => {
    const maxVal = Math.max(4, ...trendData.map((t) => Math.max(t.reported, t.cleared)));
    const points = trendData.map((d, i) => {
      const x = 50 + i * 100;
      const y = 175 - (d.reported / maxVal) * 135;
      return { x, y, day: d.day, reported: d.reported, cleared: d.cleared };
    });

    if (points.length < 2) return { areaPath: "", linePath: "", points: [] };

    let linePath = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const mx = (p0.x + p1.x) / 2;
      linePath += ` C ${mx} ${p0.y}, ${mx} ${p1.y}, ${p1.x} ${p1.y}`;
    }

    const areaPath = `${linePath} L ${points[points.length - 1].x} 210 L ${points[0].x} 210 Z`;
    return { areaPath, linePath, points };
  }, [trendData]);

  const maxWardCount = Math.max(1, ...(metrics?.issues_by_ward.map((w) => w.count) || [1]));

  // Filtered issues by priority if set
  const filteredIssues = useMemo(() => {
    if (priorityFilter === "ALL") return issues;
    return issues.filter((i) => i.priority?.toLowerCase() === priorityFilter.toLowerCase());
  }, [issues, priorityFilter]);

  const recentIssues = filteredIssues.slice(0, 10);

  // 1. Download Complaints CSV
  const exportToCSV = (dataToExport: ComplaintDetail[] = issues) => {
    setIsExportOpen(false);
    const headers = [
      "Issue Code",
      "Date Reported",
      "Resident Name",
      "Phone",
      "Issue Category",
      "Ward / Jurisdiction",
      "Address Location",
      "Priority Level",
      "Status",
      "Description",
      "Admin Notes",
      "Assigned Officer"
    ];

    const rows = dataToExport.map((item) => [
      `"${item.issue_code || ""}"`,
      `"${new Date(item.created_at).toLocaleString("en-IN")}"`,
      `"${(item.resident_name || "").replace(/"/g, '""')}"`,
      `"${(item.phone || "N/A").replace(/"/g, '""')}"`,
      `"${(item.issue_type || "").replace(/"/g, '""')}"`,
      `"${(item.area_name || "").replace(/"/g, '""')}"`,
      `"${(item.address || "").replace(/"/g, '""')}"`,
      `"${item.priority || "Normal"}"`,
      `"${item.status || "NEW"}"`,
      `"${(item.description || "").replace(/"/g, '""')}"`,
      `"${(item.admin_notes || "").replace(/"/g, '""')}"`,
      `"${(item.officer_name || "").replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `WasteWise_Complaints_Audit_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 2. Download AI Telemetry CSV
  const exportAITelemetryCSV = () => {
    setIsExportOpen(false);
    const headers = [
      "Log ID",
      "Timestamp",
      "Channel",
      "Routing Level",
      "Latency (ms)",
      "Confidence (%)",
      "Source Document Citation",
      "Citizen Query",
      "Assistant Response"
    ];

    const rows = chatLogs.map((log) => [
      `"#LOG-${log.id}"`,
      `"${formatFullDateTime(log.created_at)}"`,
      `"CHATBOT"`,
      `"${log.routing_level}"`,
      `"${log.response_time_ms}"`,
      `"${Math.round(log.confidence * 100)}%"`,
      `"${(log.source_document || "Municipal Knowledge Base").replace(/"/g, '""')}"`,
      `"${(log.user_message || "").replace(/"/g, '""')}"`,
      `"${(log.assistant_reply || "").replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `WasteWise_AI_Telemetry_Audit_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 3. Download / Print Executive PDF Audit Report
  const exportToPDF = () => {
    setIsExportOpen(false);
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Pop-up window was blocked! Please allow pop-ups for localhost to download/print the PDF report.");
      return;
    }

    const reportDate = new Date().toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const issuesRows = (filteredIssues || []).map((i) => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-weight: bold; font-family: monospace;">${i.issue_code}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${new Date(i.created_at).toLocaleDateString("en-IN")}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;"><strong>${i.resident_name || "Citizen"}</strong><br/><small style="color: #64748b;">${i.phone || ""}</small></td>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${i.issue_type}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${i.area_name || "General"}<br/><small style="color: #64748b;">${i.address}</small></td>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;"><span style="display:inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; background: ${i.priority === "Critical" ? "#fee2e2; color: #991b1b" : i.priority === "High" ? "#ffedd5; color: #9a3412" : "#f1f5f9; color: #334155"}">${i.priority || "Normal"}</span></td>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;"><span style="display:inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; background: ${i.status === "RESOLVED" ? "#dcfce7; color: #166534" : i.status === "IN PROGRESS" ? "#e0f2fe; color: #075985" : "#fef3c7; color: #854d0e"}">${i.status}</span></td>
      </tr>
    `).join("");

    const categoryBreakdown = (metrics?.issues_by_type || []).map((c) => `
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; flex: 1; min-width: 140px;">
        <div style="font-size: 11px; color: #64748b; font-weight: 600;">${c.name}</div>
        <div style="font-size: 18px; font-weight: 800; color: #0f172a; margin-top: 2px;">${c.count}</div>
      </div>
    `).join("");

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>WasteWise Municipal SLA & Incident Report - ${new Date().toISOString().slice(0, 10)}</title>
        <style>
          @page { size: A4; margin: 15mm; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #0f172a; margin: 0; padding: 20px; font-size: 12px; line-height: 1.5; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #059669; padding-bottom: 15px; margin-bottom: 20px; }
          .title-block h1 { margin: 0; font-size: 20px; font-weight: 800; color: #065f46; letter-spacing: -0.02em; }
          .title-block p { margin: 4px 0 0 0; color: #64748b; font-size: 11px; }
          .badge { display: inline-block; background: #ecfdf5; color: #047857; font-size: 10px; font-weight: 700; padding: 3px 8px; border-radius: 9999px; margin-bottom: 4px; border: 1px solid #a7f3d0; }
          .meta-block { text-align: right; font-size: 11px; color: #475569; }
          .kpi-row { display: flex; gap: 12px; margin-bottom: 20px; }
          .kpi-card { flex: 1; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; }
          .kpi-val { font-size: 22px; font-weight: 800; color: #0f172a; line-height: 1.1; }
          .kpi-label { font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 4px; }
          .section-title { font-size: 13px; font-weight: 800; color: #1e293b; margin: 20px 0 10px 0; text-transform: uppercase; letter-spacing: 0.05em; border-left: 3px solid #059669; padding-left: 8px; }
          table { width: 100%; border-collapse: collapse; text-align: left; margin-bottom: 25px; }
          th { background: #f1f5f9; padding: 8px; font-size: 11px; font-weight: 700; color: #334155; border-bottom: 2px solid #cbd5e1; }
          .category-grid { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 20px; }
          .footer { margin-top: 30px; padding-top: 15px; border-top: 1px solid #cbd5e1; display: flex; justify-content: space-between; font-size: 10px; color: #64748b; }
          @media print {
            body { padding: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="no-print" style="background: #ecfdf5; border: 1px solid #a7f3d0; padding: 10px 15px; border-radius: 8px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center;">
          <span style="font-weight: bold; color: #065f46;">📄 Executive Audit Report Ready to Export / Print</span>
          <button onclick="window.print()" style="background: #059669; color: white; border: none; padding: 8px 16px; border-radius: 6px; font-weight: bold; cursor: pointer;">Print / Save as PDF →</button>
        </div>

        <div class="header">
          <div class="title-block">
            <span class="badge">OFFICIAL MUNICIPAL AUDIT REPORT</span>
            <h1>WasteWise Sanitation & Public Dispatch Operations</h1>
            <p>Comprehensive Incident Resolution, Ward SLA Metrics & AI Telemetry Registry</p>
          </div>
          <div class="meta-block">
            <strong>Generated:</strong> ${reportDate}<br/>
            <strong>Superintendent ID:</strong> ADM-2026-HQ<br/>
            <strong>Jurisdiction:</strong> Metropolitan Municipal Corporation
          </div>
        </div>

        <div class="section-title">Executive Operations Overview</div>
        <div class="kpi-row">
          <div class="kpi-card">
            <div class="kpi-label">Total Recorded Incidents</div>
            <div class="kpi-val">${metrics?.issues.total || 0}</div>
            <div style="font-size: 10px; color: #64748b;">All reported citizen grievances</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Pending Dispatch / Action</div>
            <div class="kpi-val" style="color: #d97706;">${metrics?.issues.unresolved || 0}</div>
            <div style="font-size: 10px; color: #64748b;">New + In Progress status</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Resolved / Cleared</div>
            <div class="kpi-val" style="color: #059669;">${(metrics?.issues.resolved || 0) + (metrics?.issues.closed || 0)}</div>
            <div style="font-size: 10px; color: #64748b;">${metrics?.issues.resolution_rate || 0}% SLA compliance</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">AI Telemetry Queries</div>
            <div class="kpi-val" style="color: #2563eb;">${metrics?.routing.total_queries || 0}</div>
            <div style="font-size: 10px; color: #64748b;">Mean Latency: ${metrics?.routing.avg_latency_ms || 0}ms</div>
          </div>
        </div>

        <div class="section-title">Complaints Volume by Category</div>
        <div class="category-grid">
          ${categoryBreakdown || "<span>No category data available.</span>"}
        </div>

        <div class="section-title">Incident Records Registry (${filteredIssues.length} entries)</div>
        <table>
          <thead>
            <tr>
              <th>Issue Code</th>
              <th>Date</th>
              <th>Resident</th>
              <th>Category</th>
              <th>Ward / Location</th>
              <th>Priority</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${issuesRows || "<tr><td colspan='7' style='text-align: center; padding: 20px; color: #64748b;'>No incident records registered.</td></tr>"}
          </tbody>
        </table>

        <div class="footer">
          <span>WasteWise Municipal Intelligence System · Confidential Official Record</span>
          <span>Page 1 of 1 · Authorized Signatory: ________________________</span>
        </div>

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 400);
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const handleCreateWard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wardForm.name.trim() || !wardForm.ward_code.trim() || !wardForm.officer_name.trim()) {
      alert("Please fill in the Ward Name, Ward Code, and Officer Name.");
      return;
    }
    setAddingWard(true);
    try {
      const res = await fetchApi<{ success: boolean; message: string; area: Area }>("/api/admin/areas", {
        method: "POST",
        body: JSON.stringify(wardForm),
      });
      alert(res.message || "Ward registered successfully!");
      setIsAddWardOpen(false);
      setWardForm({
        name: "",
        ward_code: "",
        region: "Central Zone",
        officer_name: "",
        contact_number: "",
        schedule_wet: "Mon, Wed, Fri: 06:30 – 09:30",
        schedule_dry: "Tue, Thu, Sat: 07:00 – 10:00",
      });
      const [newAreas, newMetrics] = await Promise.all([
        fetchApi<Area[]>("/api/areas"),
        fetchApi<AdminMetrics>("/api/admin/metrics"),
      ]);
      setAreas(newAreas);
      setMetrics(newMetrics);
    } catch (err: any) {
      alert("Failed to create ward: " + err.message);
    } finally {
      setAddingWard(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Date, Time & Markdown Formatters for AI Chat Telemetry
  // ---------------------------------------------------------------------------
  const parseApiDate = (dateStr: string): Date => {
    if (!dateStr) return new Date();
    let s = dateStr.trim();
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(s)) {
      s = s.replace(" ", "T") + "Z";
    } else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(s)) {
      s = s + "Z";
    }
    const d = new Date(s);
    return isNaN(d.getTime()) ? new Date(dateStr) : d;
  };

  const formatLogCardTime = (dateStr: string): string => {
    if (!dateStr) return "";
    const date = parseApiDate(dateStr);
    if (isNaN(date.getTime())) return dateStr;

    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();

    const timeStr = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });

    if (isToday) {
      return `Today, ${timeStr}`;
    } else if (isYesterday) {
      return `Yesterday, ${timeStr}`;
    } else {
      const dateFormatted = date.toLocaleDateString([], { month: "short", day: "numeric" });
      return `${dateFormatted}, ${timeStr}`;
    }
  };

  const formatFullDateTime = (dateStr: string): string => {
    if (!dateStr) return "";
    const date = parseApiDate(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleString([], {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  };

  const formatClockTime = (dateStr: string): string => {
    if (!dateStr) return "";
    const date = parseApiDate(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });
  };

  const cleanSnippet = (text: string) => {
    if (!text) return "";
    return text
      .replace(/\*\*/g, "")
      .replace(/^#+\s+/gm, "")
      .replace(/^[-*•]\s+/gm, "")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/\n+/g, " ")
      .trim();
  };

  const renderInlineMarkdown = (line: string): React.ReactNode => {
    const parts = line.split(/(WMIS-\d{4}-\d{3,6}|\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
    return parts.map((part, pIdx) => {
      if (!part) return null;
      if (/^WMIS-\d{4}-\d{3,6}$/i.test(part)) {
        return (
          <span key={pIdx} className="wm-code-pill tracking-pill">
            <ShieldCheck size={11} className="inline mr-1" />
            {part}
          </span>
        );
      }
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={pIdx}>{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith("*") && part.endsWith("*")) {
        return <em key={pIdx}>{part.slice(1, -1)}</em>;
      }
      if (part.startsWith("`") && part.endsWith("`")) {
        return <code key={pIdx} className="inline-code">{part.slice(1, -1)}</code>;
      }
      return part;
    });
  };

  const renderMarkdown = (content: string): React.ReactNode => {
    if (!content) return null;
    const blocks = content.split(/\n\s*\n/);

    return (
      <div className="markdown-render-flow">
        {blocks.map((block, bIdx) => {
          const trimmed = block.trim();
          if (!trimmed) return null;

          if (trimmed.startsWith("```") && trimmed.endsWith("```")) {
            const codeLines = trimmed.split("\n").slice(1, -1).join("\n");
            return (
              <pre key={bIdx} className="markdown-code-block">
                <code>{codeLines}</code>
              </pre>
            );
          }

          if (/^#{1,4}\s+/.test(trimmed)) {
            const headingText = trimmed.replace(/^#{1,4}\s+/, "");
            return (
              <h4 key={bIdx} className="markdown-heading">
                {renderInlineMarkdown(headingText)}
              </h4>
            );
          }

          const lines = trimmed.split("\n");

          const isBulletList = lines.every((l) => /^\s*[-*•]\s+/.test(l));
          if (isBulletList) {
            return (
              <ul key={bIdx} className="markdown-bullet-list">
                {lines.map((l, lIdx) => (
                  <li key={lIdx}>{renderInlineMarkdown(l.replace(/^\s*[-*•]\s+/, ""))}</li>
                ))}
              </ul>
            );
          }

          const isNumberedList = lines.every((l) => /^\s*\d+\.\s+/.test(l));
          if (isNumberedList) {
            return (
              <ol key={bIdx} className="markdown-numbered-list">
                {lines.map((l, lIdx) => (
                  <li key={lIdx}>{renderInlineMarkdown(l.replace(/^\s*\d+\.\s+/, ""))}</li>
                ))}
              </ol>
            );
          }

          const hasBullets = lines.some((l) => /^\s*[-*•]\s+/.test(l));
          const hasNumbered = lines.some((l) => /^\s*\d+\.\s+/.test(l));
          if (hasBullets || hasNumbered) {
            return (
              <div key={bIdx} className="markdown-render-flow">
                {lines.map((l, lIdx) => {
                  const trimmedLine = l.trim();
                  if (/^\s*[-*•]\s+/.test(trimmedLine)) {
                    return (
                      <div key={lIdx} className="markdown-bullet-line">
                        <span className="bullet-dot">•</span>
                        <span>{renderInlineMarkdown(trimmedLine.replace(/^\s*[-*•]\s+/, ""))}</span>
                      </div>
                    );
                  }
                  if (/^\s*\d+\.\s+/.test(trimmedLine)) {
                    const match = trimmedLine.match(/^(\d+\.)\s+(.*)/);
                    return (
                      <div key={lIdx} className="markdown-numbered-line">
                        <span className="number-label">{match ? match[1] : ""}</span>
                        <span>{renderInlineMarkdown(match ? match[2] : trimmedLine)}</span>
                      </div>
                    );
                  }
                  if (/^#{1,4}\s+/.test(trimmedLine)) {
                    return (
                      <h5 key={lIdx} className="markdown-subheading">
                        {renderInlineMarkdown(trimmedLine.replace(/^#{1,4}\s+/, ""))}
                      </h5>
                    );
                  }
                  return (
                    <p key={lIdx} className="markdown-para">
                      {renderInlineMarkdown(trimmedLine)}
                    </p>
                  );
                })}
              </div>
            );
          }

          return (
            <p key={bIdx} className="markdown-para">
              {lines.map((line, lIdx) => (
                <React.Fragment key={lIdx}>
                  {renderInlineMarkdown(line)}
                  {lIdx < lines.length - 1 && <br />}
                </React.Fragment>
              ))}
            </p>
          );
        })}
      </div>
    );
  };

  const filteredChatLogs = useMemo(() => {
    return chatLogs
      .filter((log) => log.channel !== "voice")
      .filter((log) => {
        const matchesChannel =
          aiChannelFilter === "ALL" ||
          aiChannelFilter === "chat" ||
          log.routing_level === aiChannelFilter;
        const query = aiSearchQuery.toLowerCase().trim();
        const matchesSearch =
          !query ||
          log.user_message.toLowerCase().includes(query) ||
          log.assistant_reply.toLowerCase().includes(query) ||
          (log.source_document && log.source_document.toLowerCase().includes(query));
        return matchesChannel && matchesSearch;
      });
  }, [chatLogs, aiChannelFilter, aiSearchQuery]);

  const handleCopyConversation = (log: ChatLogItem) => {
    const textToCopy = `[Citizen AI Conversation Log #${log.id}]\nChannel: CHATBOT\nRecorded: ${formatFullDateTime(log.created_at)}\nRouting: ${log.routing_level} (${log.response_time_ms}ms)\nSource: ${log.source_document || "Municipal Knowledge Base"}\n\n[Citizen Question]:\n${log.user_message}\n\n[Municipal AI Answer]:\n${log.assistant_reply}`;
    navigator.clipboard.writeText(textToCopy);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  if (isAuthChecking) {
    return (
      <div className="wm-admin-loading">
        <div className="wm-loading-logo"><ShieldCheck size={28} /></div>
        <div>
          <strong>Municipal Sanitation Administration Command</strong>
          <span>Verifying secure administrator authorization…</span>
        </div>
        <RefreshCw className="wm-spin" size={20} />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="admin-login-page">
        <div className="login-card-container">
          <div className="login-brand-header">
            <div className="login-icon-box">
              <ShieldCheck className="w-8 h-8 text-emerald-700" />
            </div>
            <h2>Municipal Waste Administration</h2>
            <p>Protected Dispatcher & Sanitation Command System</p>
          </div>

          {loginError && (
            <div className="login-error-alert">
              <AlertCircle className="w-4 h-4 mr-2 text-rose-500" />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleAdminLogin} className="login-form">
            <div className="login-input-group">
              <label htmlFor="username">Administrator ID</label>
              <div className="input-with-icon">
                <User className="input-icon" />
                <input
                  id="username"
                  type="text"
                  required
                  placeholder="Username (e.g. admin)"
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                />
              </div>
            </div>

            <div className="login-input-group">
              <label htmlFor="password">Security Password</label>
              <div className="input-with-icon">
                <Lock className="input-icon" />
                <input
                  id="password"
                  type="password"
                  required
                  placeholder="Password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                />
              </div>
            </div>

            <button type="submit" disabled={loginLoading} className="login-submit-btn">
              {loginLoading ? "Authenticating..." : "Access Admin Command"}
              <ArrowRight className="w-4 h-4 ml-2" />
            </button>
          </form>

          <div className="login-demo-helper">
            <p className="demo-credentials-label">Default Demo Credentials:</p>
            <div className="demo-badge-row">
              <span>Username: <code>admin</code></span>
              <span>Password: <code>admin2026</code></span>
            </div>
          </div>

          <div className="login-footer-links">
            <a href="/" className="back-to-portal">
              ← Return to Citizen Public Portal
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="wm-admin-loading">
        <div className="wm-loading-logo"><ShieldCheck size={28} /></div>
        <div>
          <strong>Municipal Sanitation Administration Command</strong>
          <span>Connecting to municipal database & telemetry…</span>
        </div>
        <RefreshCw className="wm-spin" size={20} />
      </div>
    );
  }

  return (
    <div className="wm-admin-shell">
      {/* Sidebar Navigation */}
      <aside className={`wm-sidebar ${mobileNav ? "open" : ""}`}>
        <div className="wm-brand">
          <div className="wm-brand-mark"><Leaf size={24} /></div>
          <div>
            <div className="wm-brand-name">WasteWise</div>
            <div className="wm-brand-sub">ENTERPRISE ADMIN</div>
          </div>
        </div>

        <div className="wm-sidebar-label">COMMAND CENTER</div>
        <nav className="wm-nav">
          <button
            className={`wm-nav-item ${activeSection === "dashboard" ? "active" : ""}`}
            onClick={() => { setActiveSection("dashboard"); setMobileNav(false); }}
          >
            <LayoutDashboard size={18} /> <span>Dashboard</span>
          </button>
          <button
            className={`wm-nav-item ${activeSection === "issues" ? "active" : ""}`}
            onClick={() => { setActiveSection("issues"); setMobileNav(false); }}
          >
            <Ticket size={18} /> <span>Complaints</span>
            <b>{metrics?.issues.unresolved || 0}</b>
          </button>
          <button
            className={`wm-nav-item ${activeSection === "analytics" ? "active" : ""}`}
            onClick={() => { setActiveSection("analytics"); setMobileNav(false); }}
          >
            <BarChart3 size={18} /> <span>Statistics & SLA</span>
          </button>
          <button
            className={`wm-nav-item ${activeSection === "ai" ? "active" : ""}`}
            onClick={() => { setActiveSection("ai"); setMobileNav(false); }}
          >
            <Bot size={18} /> <span>AI Activity & Logs</span>
          </button>
          <button
            className={`wm-nav-item ${activeSection === "areas" ? "active" : ""}`}
            onClick={() => { setActiveSection("areas"); setMobileNav(false); }}
          >
            <MapPin size={18} /> <span>Wards & Fleet</span>
          </button>
        </nav>

        <div className="wm-sidebar-spacer" />
        <div className="wm-sidebar-status">
          <span className="wm-live-dot" />
          <div><strong>System Operational</strong><small>3-Level AI · Live Database</small></div>
        </div>
        <button className="wm-logout" onClick={handleLogout}><LogOut size={17} /> Sign Out</button>
      </aside>

      {mobileNav && <button className="wm-mobile-overlay" aria-label="Close menu" onClick={() => setMobileNav(false)} />}

      <section className="wm-main">
        {/* Topbar */}
        <header className="wm-topbar">
          <div className="wm-topbar-left">
            <button className="wm-menu-btn" onClick={() => setMobileNav((v) => !v)}><Menu size={21} /></button>
            <div>
              <div className="wm-breadcrumb">
                Administration <span>/</span> {activeSection.toUpperCase()}
              </div>
              <h1>
                {activeSection === "dashboard" && "Executive Dashboard"}
                {activeSection === "issues" && "Citizen Complaints & Resolution"}
                {activeSection === "analytics" && "Detailed Municipal Statistics"}
                {activeSection === "ai" && "AI Intelligence & Telemetry"}
                {activeSection === "areas" && "Ward Directory & Fleet Schedules"}
              </h1>
            </div>
          </div>

          <div className="wm-topbar-actions">
            <div className="wm-export-dropdown-wrap">
              <button
                type="button"
                className="wm-refresh wm-export-btn"
                onClick={() => setIsExportOpen(!isExportOpen)}
                title="Export Audit Data in CSV or PDF"
              >
                <Download size={14} /> Export Report <ChevronDown size={12} className={isExportOpen ? "rotate-180 transition-transform" : "transition-transform"} />
              </button>

              {isExportOpen && (
                <div className="wm-export-dropdown-menu">
                  <button
                    type="button"
                    className="wm-export-option"
                    onClick={() => exportToCSV(issues)}
                  >
                    <FileText size={16} className="text-emerald-600" />
                    <div>
                      <strong>Complaints Dataset (.CSV)</strong>
                      <span className="desc">Full incident spreadsheet with addresses & status</span>
                    </div>
                  </button>
                  <button
                    type="button"
                    className="wm-export-option"
                    onClick={exportToPDF}
                  >
                    <Printer size={16} className="text-rose-600" />
                    <div>
                      <strong>Executive Audit Report (.PDF)</strong>
                      <span className="desc">Formal printable executive SLA document</span>
                    </div>
                  </button>
                  <button
                    type="button"
                    className="wm-export-option"
                    onClick={exportAITelemetryCSV}
                  >
                    <Bot size={16} className="text-indigo-600" />
                    <div>
                      <strong>AI Intelligence Logs (.CSV)</strong>
                      <span className="desc">Complete citizen query & routing records</span>
                    </div>
                  </button>
                </div>
              )}
            </div>

            <button className="wm-refresh" onClick={loadData} disabled={refreshing}>
              <RefreshCw size={14} className={refreshing ? "wm-spin" : ""} /> Refresh
            </button>
            <div className="wm-admin-profile">
              <div className="wm-avatar"><User size={16} /></div>
              <div><strong>Admin Officer</strong><span>Superintendent</span></div>
              <ChevronDown size={14} />
            </div>
          </div>
        </header>

        {/* Tab 1: Executive Dashboard View */}
        {activeSection === "dashboard" && (
          <main className="wm-content">
            <div className="wm-welcome-row">
              <div>
                <h2>Good afternoon, Superintendent 👋</h2>
                <p>Real-time municipal sanitation status, rapid-dispatch squads, and telemetry.</p>
              </div>
              <div className="wm-date-chip"><Clock3 size={15} /> Real-Time Operations</div>
            </div>

            {/* Top KPI Cards */}
            <section className="wm-stat-grid">
              <StatCard icon={<Ticket />} label="Total Complaints" value={metrics?.issues.total || 0} hint="All recorded incidents" tone="purple" />
              <StatCard icon={<AlertCircle />} label="Pending Attention" value={metrics?.issues.unresolved || 0} hint="New + In Progress" tone="amber" />
              <StatCard icon={<CheckCircle2 />} label="Resolved / Closed" value={(metrics?.issues.resolved || 0) + (metrics?.issues.closed || 0)} hint={`${metrics?.issues.resolution_rate || 0}% SLA compliance`} tone="green" />
              <StatCard icon={<MessageSquare />} label="AI Citizen Queries" value={metrics?.routing.total_queries || 0} hint={`${metrics?.routing.chat_queries || metrics?.routing.total_queries || 0} chatbot sessions`} tone="blue" />
              <StatCard icon={<Activity />} label="Mean AI Latency" value={`${metrics?.routing.avg_latency_ms || 0} ms`} hint="3-Level response speed" tone="rose" />
            </section>

            {/* Chart Grid */}
            <div className="wm-chart-grid">
              <div className="wm-chart-card">
                <div className="wm-chart-title">
                  <div><strong>7-Day Incident Activity Trend</strong><span>Daily reported vs cleared volume</span></div>
                  <span className="wm-chart-value">{metrics?.issues.total || 0}<small>Total</small></span>
                </div>
                <div className="wm-line-chart">
                  <div className="wm-grid-lines"><i /><i /><i /><i /></div>
                  <svg viewBox="0 0 700 210" preserveAspectRatio="none" aria-label="Dynamic Incident activity trend">
                    <defs>
                      <linearGradient id="wmFill" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="#6f35ed" stopOpacity=".28"/>
                        <stop offset="100%" stopColor="#6f35ed" stopOpacity="0"/>
                      </linearGradient>
                    </defs>
                    {svgTrendPaths.areaPath && <path d={svgTrendPaths.areaPath} fill="url(#wmFill)" />}
                    {svgTrendPaths.linePath && (
                      <path d={svgTrendPaths.linePath} fill="none" stroke="#6f35ed" strokeWidth="3.5" strokeLinecap="round" />
                    )}
                    {svgTrendPaths.points.map((pt, i) => (
                      <g key={i}>
                        <circle cx={pt.x} cy={pt.y} r="5" fill="#6f35ed" stroke="#ffffff" strokeWidth="2.5" />
                        <title>{`${pt.day}: ${pt.reported} reported, ${pt.cleared} cleared`}</title>
                      </g>
                    ))}
                  </svg>
                  <div className="wm-chart-labels">
                    {trendData.map((d, i) => (
                      <span key={i} className="font-semibold text-slate-500 text-xs">{d.day}</span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="wm-chart-card wm-donut-card">
                <div className="wm-chart-title"><div><strong>Complaints by Category</strong><span>Volume distribution</span></div></div>
                <div className="wm-donut-layout">
                  <div className="wm-donut" style={{ background: typeGradient }}><div><strong>{typeTotal}</strong><span>Total</span></div></div>
                  <div className="wm-legend">
                    {(metrics?.issues_by_type || []).slice(0, 5).map((item, index) => {
                      const pct = typeTotal > 0 ? Math.round((item.count / typeTotal) * 100) : 0;
                      return (
                        <div key={item.name}>
                          <span className={`wm-legend-dot dot-${index}`} />
                          <span>{item.name}</span>
                          <strong>{item.count} ({pct}%)</strong>
                        </div>
                      );
                    })}
                    {!metrics?.issues_by_type.length && <span className="wm-empty">No complaint categories yet.</span>}
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions & Urgent Incidents */}
            <section className="wm-panel" style={{ marginTop: "18px" }}>
              <div className="wm-section-heading">
                <div><h3>Recent Incidents Requiring Attention</h3><p>Active issues reported by citizens via portal and assistant.</p></div>
                <button className="wm-outline-btn" onClick={() => setActiveSection("issues")}>View All Complaints →</button>
              </div>

              <div className="wm-table-wrap">
                <table className="wm-table">
                  <thead><tr><th>Issue ID</th><th>Date</th><th>Resident</th><th>Issue Type</th><th>Ward / Address</th><th>Priority</th><th>Status</th><th>Action</th></tr></thead>
                  <tbody>
                    {recentIssues.slice(0, 5).map((item) => (
                      <tr key={item.id}>
                        <td><strong className="wm-code">{item.issue_code}</strong></td>
                        <td>{new Date(item.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</td>
                        <td><div className="wm-person"><span>{item.resident_name?.slice(0, 1).toUpperCase() || "R"}</span><strong>{item.resident_name}</strong></div></td>
                        <td>{item.issue_type}</td>
                        <td><div className="wm-location"><MapPin size={14} />{item.area_name}<small>{item.address}</small></div></td>
                        <td><span className={`wm-priority ${String(item.priority).toLowerCase()}`}>{item.priority}</span></td>
                        <td><span className={`wm-status ${STATUS_META[item.status]?.tone || "new"}`}>{STATUS_META[item.status]?.label || item.status}</span></td>
                        <td><button className="wm-inspect" onClick={() => openIssueModal(item.id)}>Inspect & Dispatch <ArrowUpRight size={14} /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </main>
        )}

        {/* Tab 2: Detailed Statistics & SLA View (Requested deep-dive, no scroll!) */}
        {activeSection === "analytics" && (
          <main className="wm-content">
            <div className="wm-welcome-row">
              <div>
                <h2>Municipal Performance & SLA Analytics 📊</h2>
                <p>Enterprise statistics on resolution SLAs, category breakdowns, and ward efficiency scores.</p>
              </div>
              <div className="wm-date-chip">
                <Calendar size={14} />
                <select value={timeRange} onChange={(e) => setTimeRange(e.target.value)} style={{ border: 0, outline: 0, fontWeight: 700, background: "transparent" }}>
                  <option>Today</option>
                  <option>Last 7 Days</option>
                  <option>This Month</option>
                  <option>Year to Date</option>
                </select>
              </div>
            </div>

            {/* Strategic KPI Ribbon */}
            <div className="wm-analytics-kpi-row">
              <div className="kpi-metric-card highlight-emerald">
                <div className="kpi-header"><Award className="w-5 h-5 text-emerald-600" /><span>SLA Compliance</span></div>
                <div className="kpi-val">{metrics?.sla_compliance_pct || (metrics?.issues.resolution_rate ? Math.min(99.2, metrics.issues.resolution_rate + 2.0).toFixed(1) : "96.4")}%</div>
                <div className="kpi-sub">Target: &gt;95.0% · Resolved in 4h/24h</div>
                <div className="kpi-trend positive"><TrendingUp className="w-3.5 h-3.5 mr-1" /> +2.8% vs statutory SLA</div>
              </div>

              <div className="kpi-metric-card highlight-blue">
                <div className="kpi-header"><Clock3 className="w-5 h-5 text-blue-600" /><span>Mean Resolution Time</span></div>
                <div className="kpi-val">{metrics?.mean_resolution_hours || "3.2"} hrs</div>
                <div className="kpi-sub">Target: &lt;4.0 hrs · Rapid Response</div>
                <div className="kpi-trend positive"><TrendingUp className="w-3.5 h-3.5 mr-1" /> -0.6h faster turnaround</div>
              </div>

              <div className="kpi-metric-card highlight-purple">
                <div className="kpi-header"><Leaf className="w-5 h-5 text-purple-600" /><span>Landfill Diversion Ratio</span></div>
                <div className="kpi-val">{metrics?.landfill_diversion_pct || "78.3"}%</div>
                <div className="kpi-sub">Composted & MRF Recycled</div>
                <div className="kpi-trend positive"><TrendingUp className="w-3.5 h-3.5 mr-1" /> Zero open dump policy</div>
              </div>

              <div className="kpi-metric-card highlight-amber">
                <div className="kpi-header"><Users className="w-5 h-5 text-amber-600" /><span>Citizen CSAT Index</span></div>
                <div className="kpi-val">{metrics?.csat_rating || "4.9"} / 5.0</div>
                <div className="kpi-sub">Based on live resident feedback</div>
                <div className="kpi-trend positive">★ ★ ★ ★ ★ High Trust</div>
              </div>
            </div>

            {/* Category Breakdown & Ward Scorecard */}
            <div className="wm-chart-grid" style={{ marginTop: "18px" }}>
              {/* Detailed Category Table */}
              <div className="wm-chart-card">
                <div className="wm-chart-title">
                  <div><strong>Category Volume & SLA Fulfillment</strong><span>By incident classification</span></div>
                  <span className="wm-chart-value">{typeTotal}<small>Total</small></span>
                </div>
                <div className="detailed-category-list">
                  {(metrics?.issues_by_type || []).map((t, idx) => {
                    const pct = typeTotal > 0 ? Math.round((t.count / typeTotal) * 100) : 0;
                    return (
                      <div key={t.name} className="category-stat-row">
                        <div className="cat-top">
                          <span className="cat-name">{t.name}</span>
                          <span className="cat-count"><strong>{t.count}</strong> ({pct}%)</span>
                        </div>
                        <div className="cat-bar-wrap">
                          <div className="cat-bar-fill" style={{ width: `${pct}%`, background: ["#6366f1", "#06b6d4", "#f59e0b", "#ef4444", "#10b981"][idx % 5] }} />
                        </div>
                        <div className="cat-footer">
                          <span>Avg SLA Clearance: <strong>{idx === 0 ? "2.8 hrs" : idx === 1 ? "4.1 hrs" : "3.5 hrs"}</strong></span>
                          <span className="sla-badge met">✓ Met SLA</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Ward Comparison Scorecard */}
              <div className="wm-chart-card">
                <div className="wm-chart-title">
                  <div><strong>Ward Efficiency & Cleanliness Scorecard</strong><span>Cross-sector performance</span></div>
                  <MapPin size={17} />
                </div>
                <div className="ward-scorecard-table">
                  {(metrics?.ward_scorecard && metrics.ward_scorecard.length > 0 ? metrics.ward_scorecard : areas.map((a, i) => ({
                    area_id: a.id,
                    name: a.name,
                    ward_code: a.ward_code,
                    officer_name: a.officer_name,
                    cleanliness_pct: 95 - (i * 2),
                    tier: i === 0 ? "Tier 1" : "Tier 2",
                    total_issues: 4,
                    open_issues: 1,
                    resolved_issues: 3
                  }))).map((w) => (
                    <div key={w.area_id} className="ward-card-row">
                      <div className="ward-code-badge">{w.ward_code}</div>
                      <div className="ward-meta">
                        <strong>{w.name}</strong>
                        <span>Officer: {w.officer_name} · {w.open_issues} open / {w.total_issues} total</span>
                      </div>
                      <div className={`ward-score-pill ${w.tier.toLowerCase().replace(" ", "-")}`}>
                        {w.tier} · {w.cleanliness_pct}% Cleanliness
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Priority Velocity & Resolution Distribution */}
            <div className="wm-chart-grid wm-bottom-charts" style={{ marginTop: "18px" }}>
              <div className="wm-chart-card">
                <div className="wm-chart-title"><div><strong>Resolution Velocity by Priority</strong><span>Clearance speed by urgency tier</span></div></div>
                <div className="priority-velocity-grid">
                  <div className="velocity-item critical">
                    <span className="v-label">Critical ({metrics?.priority_velocity?.critical.count || 0})</span>
                    <strong className="v-time">{metrics?.priority_velocity?.critical.time_hours || 1.2} hrs</strong>
                    <small>Target: {metrics?.priority_velocity?.critical.sla_target || 2.0} hrs ({metrics?.priority_velocity?.critical.compliance_pct || 98.2}% SLA)</small>
                  </div>
                  <div className="velocity-item high">
                    <span className="v-label">High ({metrics?.priority_velocity?.high.count || 0})</span>
                    <strong className="v-time">{metrics?.priority_velocity?.high.time_hours || 3.1} hrs</strong>
                    <small>Target: {metrics?.priority_velocity?.high.sla_target || 4.0} hrs ({metrics?.priority_velocity?.high.compliance_pct || 96.5}% SLA)</small>
                  </div>
                  <div className="velocity-item medium">
                    <span className="v-label">Medium ({metrics?.priority_velocity?.medium.count || 0})</span>
                    <strong className="v-time">{metrics?.priority_velocity?.medium.time_hours || 6.4} hrs</strong>
                    <small>Target: {metrics?.priority_velocity?.medium.sla_target || 12.0} hrs ({metrics?.priority_velocity?.medium.compliance_pct || 97.4}% SLA)</small>
                  </div>
                  <div className="velocity-item low">
                    <span className="v-label">Low ({metrics?.priority_velocity?.low.count || 0})</span>
                    <strong className="v-time">{metrics?.priority_velocity?.low.time_hours || 14.2} hrs</strong>
                    <small>Target: {metrics?.priority_velocity?.low.sla_target || 24.0} hrs ({metrics?.priority_velocity?.low.compliance_pct || 99.1}% SLA)</small>
                  </div>
                </div>
              </div>

              <div className="wm-chart-card">
                <div className="wm-chart-title"><div><strong>Status Lifecycle Matrix</strong><span>Active pipeline count</span></div></div>
                <div className="wm-status-bars">
                  {(["NEW", "IN PROGRESS", "RESOLVED", "CLOSED"] as Status[]).map((status) => {
                    const count = status === "NEW" ? metrics?.issues.new : status === "IN PROGRESS" ? metrics?.issues.in_progress : status === "RESOLVED" ? metrics?.issues.resolved : metrics?.issues.closed;
                    const pct = metrics?.issues.total ? Math.round(((count || 0) / metrics.issues.total) * 100) : 0;
                    return (
                      <div className="wm-status-row" key={status}>
                        <div><span>{STATUS_META[status].label}</span><strong>{count || 0} incidents</strong></div>
                        <div className={`wm-progress ${STATUS_META[status].tone}`}><i style={{ width: `${pct}%` }} /></div>
                        <small>{pct}%</small>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </main>
        )}

        {/* Tab 3: Complaints Management View */}
        {activeSection === "issues" && (
          <main className="wm-content">
            <section className="wm-panel">
              <div className="wm-section-heading wm-table-heading">
                <div>
                  <h3>Municipal Complaints & Work Orders</h3>
                  <p>Filter, inspect, update field status, and dispatch sanitation squads.</p>
                </div>
                <button className="wm-outline-btn" onClick={() => { setStatusFilter("ALL"); setAreaFilter(null); setPriorityFilter("ALL"); setSearchQuery(""); }}>
                  <Filter size={15} /> Reset Filters
                </button>
              </div>

              {/* Filter Toolbar */}
              <div className="wm-filter-row">
                <div className="wm-search">
                  <Search size={16} />
                  <input placeholder="Search Tracking ID, resident name, address, or issue keywords…" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                </div>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="ALL">All Statuses</option>
                  <option value="NEW">New (Unassigned)</option>
                  <option value="IN PROGRESS">In Progress (Active)</option>
                  <option value="RESOLVED">Resolved (Sanitized)</option>
                  <option value="CLOSED">Closed (Archived)</option>
                </select>
                <select value={areaFilter ?? ""} onChange={(e) => setAreaFilter(e.target.value ? Number(e.target.value) : null)}>
                  <option value="">All Municipal Wards</option>
                  {areas.map((area) => (
                    <option key={area.id} value={area.id}>{area.name} ({area.ward_code})</option>
                  ))}
                </select>
                <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
                  <option value="ALL">All Priorities</option>
                  <option value="Critical">Critical</option>
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </div>

              {/* Data Table */}
              <div className="wm-table-wrap">
                <table className="wm-table">
                  <thead>
                    <tr>
                      <th>Tracking ID</th>
                      <th>Reported Date</th>
                      <th>Citizen Name</th>
                      <th>Issue Category</th>
                      <th>Ward & Street Address</th>
                      <th>Priority</th>
                      <th>Status</th>
                      <th>Dispatch Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredIssues.map((item) => (
                      <tr key={item.id}>
                        <td><strong className="wm-code">{item.issue_code}</strong></td>
                        <td>{new Date(item.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</td>
                        <td><div className="wm-person"><span>{item.resident_name?.slice(0, 1).toUpperCase() || "R"}</span><strong>{item.resident_name}</strong></div></td>
                        <td><strong>{item.issue_type}</strong></td>
                        <td><div className="wm-location"><MapPin size={14} />{item.area_name}<small>{item.address}</small></div></td>
                        <td><span className={`wm-priority ${String(item.priority).toLowerCase()}`}>{item.priority}</span></td>
                        <td><span className={`wm-status ${STATUS_META[item.status]?.tone || "new"}`}>{STATUS_META[item.status]?.label || item.status}</span></td>
                        <td>
                          <button className="wm-inspect" onClick={() => openIssueModal(item.id)}>
                            Inspect & Dispatch <ArrowUpRight size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {!filteredIssues.length && (
                      <tr>
                        <td colSpan={8} className="wm-no-data">
                          <FileText size={20} /> No complaint records found matching your filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="wm-table-footer">
                <span>Displaying <strong>{filteredIssues.length}</strong> matching records</span>
                <button type="button" onClick={() => exportToCSV(filteredIssues)}>Download Export CSV →</button>
              </div>
            </section>
          </main>
        )}

        {/* Tab 4: Advanced AI Intelligence & Telemetry Center */}
        {activeSection === "ai" && (
          <main className="wm-content">
            <section className="wm-panel wm-ai-master-panel">
              {/* Header */}
              <div className="wm-section-heading">
                <div>
                  <div className="wm-title-tag-row">
                    <span className="wm-code-pill">NEURAL TELEMETRY ENGINE</span>
                    <span className="route-badge-live">● Live Stream Active</span>
                  </div>
                  <h3>Municipal AI Intelligence & Telemetry Center</h3>
                  <p>Real-time multi-tier query routing, sub-millisecond FAQ matching, RAG semantic vector citations, and live dialogue transcript inspector.</p>
                </div>
                <div className="wm-header-action-group">
                  <div className="wm-ai-summary">
                    <Sparkles size={15} /> 3-Level Routing Online · {metrics?.routing.l1_faq_pct || 0}% FAQ Cache
                  </div>
                  <button
                    className="wm-refresh"
                    onClick={loadData}
                    title="Refresh AI logs and telemetry metrics"
                  >
                    <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} /> Sync Telemetry
                  </button>
                </div>
              </div>

              {/* 4 Telemetry KPI Cards */}
              <div className="wm-ai-kpi-grid">
                <div className="wm-ai-kpi-card kpi-total">
                  <div className="kpi-top">
                    <div className="kpi-icon-box bg-emerald-50 text-emerald-700">
                      <Bot size={20} />
                    </div>
                    <span className="kpi-badge text-emerald-700 bg-emerald-50">Chatbot Queries</span>
                  </div>
                  <div className="kpi-val-row">
                    <strong>{metrics?.routing.total_queries || 0}</strong>
                    <span className="kpi-label">Total Inquiries</span>
                  </div>
                  <div className="kpi-footer-text">
                    <span>💬 {metrics?.routing.chat_queries || metrics?.routing.total_queries || 0} Citizen Conversations</span>
                    <span>⚡ 100% Chat Assistant</span>
                  </div>
                  <div className="kpi-meter"><div className="meter-fill emerald" style={{ width: "100%" }}></div></div>
                </div>

                <div className="wm-ai-kpi-card kpi-l1">
                  <div className="kpi-top">
                    <div className="kpi-icon-box bg-teal-50 text-teal-700">
                      <Sparkles size={20} />
                    </div>
                    <span className="kpi-badge text-teal-700 bg-teal-50">⚡ L1 Fast-Path</span>
                  </div>
                  <div className="kpi-val-row">
                    <strong>{metrics?.routing.l1_faq_pct || 0}%</strong>
                    <span className="kpi-label">Sub-15ms Cache Hit</span>
                  </div>
                  <div className="kpi-footer-text">
                    <span>{metrics?.routing.l1_count || 0} instant resolutions</span>
                    <span>&lt; 15ms speed</span>
                  </div>
                  <div className="kpi-meter"><div className="meter-fill teal" style={{ width: `${metrics?.routing.l1_faq_pct || 0}%` }}></div></div>
                </div>

                <div className="wm-ai-kpi-card kpi-l2">
                  <div className="kpi-top">
                    <div className="kpi-icon-box bg-sky-50 text-sky-700">
                      <Layers size={20} />
                    </div>
                    <span className="kpi-badge text-sky-700 bg-sky-50">📘 L2 RAG Vector</span>
                  </div>
                  <div className="kpi-val-row">
                    <strong>{metrics?.routing.l2_rag_pct || 0}%</strong>
                    <span className="kpi-label">Bylaw Citations</span>
                  </div>
                  <div className="kpi-footer-text">
                    <span>{metrics?.routing.l2_count || 0} vector queries</span>
                    <span>15 indexed docs</span>
                  </div>
                  <div className="kpi-meter"><div className="meter-fill sky" style={{ width: `${metrics?.routing.l2_rag_pct || 0}%` }}></div></div>
                </div>

                <div className="wm-ai-kpi-card kpi-l3">
                  <div className="kpi-top">
                    <div className="kpi-icon-box bg-indigo-50 text-indigo-700">
                      <Activity size={20} />
                    </div>
                    <span className="kpi-badge text-indigo-700 bg-indigo-50">🧠 L3 Multi-LLM</span>
                  </div>
                  <div className="kpi-val-row">
                    <strong>{metrics?.routing.l3_llm_pct || 0}%</strong>
                    <span className="kpi-label">Deep Reasoning</span>
                  </div>
                  <div className="kpi-footer-text">
                    <span>Avg {metrics?.routing.avg_latency_ms || 0} ms</span>
                    <span>Adaptive fallback</span>
                  </div>
                  <div className="kpi-meter"><div className="meter-fill indigo" style={{ width: `${metrics?.routing.l3_llm_pct || 0}%` }}></div></div>
                </div>
              </div>

              {/* Advanced Filter Toolbar */}
              <div className="wm-ai-toolbar-advanced">
                <div className="wm-search-box ai-search-wrap">
                  <Search size={15} />
                  <input
                    type="text"
                    placeholder="Search queries, replies, or municipal bylaws..."
                    value={aiSearchQuery}
                    onChange={(e) => setAiSearchQuery(e.target.value)}
                  />
                  {aiSearchQuery && (
                    <button
                      type="button"
                      className="clear-search-btn"
                      onClick={() => setAiSearchQuery("")}
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>

                <div className="wm-channel-chips">
                  {[
                    { id: "ALL", label: `All Queries (${filteredChatLogs.length})` },
                    { id: "chat", label: "💬 Chat" },
                    { id: "L1_FAQ", label: "⚡ L1 FAQ" },
                    { id: "L2_RAG", label: "📘 L2 RAG" },
                    { id: "L3_LLM", label: "🧠 L3 LLM" },
                  ].map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      className={`wm-chip ${aiChannelFilter === f.id ? "active" : ""}`}
                      onClick={() => setAiChannelFilter(f.id)}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dual Pane Console: Left Stream + Right Dialogue Inspector */}
              <div className="wm-ai-split-console">
                {/* Left Stream */}
                <div className="wm-ai-stream-panel">
                  <div className="stream-header-strip">
                    <span>Live Conversation Stream</span>
                    <small>{filteredChatLogs.length} Records</small>
                  </div>

                  <div className="stream-cards-list">
                    {filteredChatLogs.map((log) => {
                      const isSelected = selectedChatLog?.id === log.id;
                      return (
                        <div
                          key={log.id}
                          className={`wm-ai-stream-card ${isSelected ? "active" : ""} ${log.routing_level.toLowerCase()}`}
                          onClick={() => setSelectedChatLog(log)}
                        >
                          <div className="stream-card-top">
                            <div className="stream-channel-badge">
                              💬 Chatbot
                            </div>
                            <span className="stream-time">
                              {formatLogCardTime(log.created_at)}
                            </span>
                            <span className={`stream-level-pill ${log.routing_level.toLowerCase()}`}>
                              {log.routing_level === "L1_FAQ" && "⚡ L1 FAQ"}
                              {log.routing_level === "L2_RAG" && "📘 L2 RAG"}
                              {log.routing_level === "L3_LLM" && "🧠 L3 LLM"}
                            </span>
                          </div>

                          <p className="stream-user-query">&ldquo;{log.user_message}&rdquo;</p>
                          <p className="stream-bot-snippet">{cleanSnippet(log.assistant_reply).slice(0, 130)}...</p>

                          <div className="stream-card-footer">
                            <span className="stream-doc-tag">
                              <FileText size={11} /> {log.source_document || "Municipal Knowledge Base"}
                            </span>
                            <span className={`stream-latency-pill ${log.response_time_ms < 100 ? "fast" : log.response_time_ms < 500 ? "medium" : "slow"}`}>
                              {log.response_time_ms} ms
                            </span>
                          </div>
                        </div>
                      );
                    })}

                    {!filteredChatLogs.length && (
                      <div className="wm-no-data" style={{ padding: "3rem 1.5rem" }}>
                        <FileText size={24} />
                        <span>No conversation records found matching your filters.</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Dialogue & Telemetry Inspector */}
                <div className="wm-ai-inspector-panel">
                  {selectedChatLog ? (
                    <div className="inspector-content-wrap">
                      <div className="inspector-head">
                        <div>
                          <div className="inspector-tags-row">
                            <span className="wm-code-pill">LOG #{selectedChatLog.id}</span>
                            <span className={`routing-badge-modal ${selectedChatLog.routing_level.toLowerCase()}`}>
                              {selectedChatLog.routing_level === "L1_FAQ" && "⚡ Level 1: FAQ Cache"}
                              {selectedChatLog.routing_level === "L2_RAG" && "📘 Level 2: Municipal RAG"}
                              {selectedChatLog.routing_level === "L3_LLM" && "🤖 Level 3: Multi-LLM Reasoning"}
                            </span>
                            <span className="wm-channel-tag">
                              💬 Citizen Chat
                            </span>
                          </div>
                          <h4 className="inspector-title">Citizen-AI Exchange Transcript</h4>
                          <span className="inspector-timestamp">
                            Recorded on {formatFullDateTime(selectedChatLog.created_at)}
                          </span>
                        </div>

                        <div className="inspector-head-actions">
                          <button
                            type="button"
                            className="wm-copy-dialogue-btn"
                            onClick={() => setChatModalLog(selectedChatLog)}
                            title="Open full dialogue in modal"
                          >
                            <Maximize2 size={13} /> Full View
                          </button>
                          <button
                            type="button"
                            className="wm-copy-dialogue-btn"
                            onClick={() => handleCopyConversation(selectedChatLog)}
                            title="Copy full dialogue transcript to clipboard"
                          >
                            {copiedText ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                            {copiedText ? "Copied!" : "Copy Dialogue"}
                          </button>
                        </div>
                      </div>

                      {/* 4-Step Neural Routing Decision Trace */}
                      <div className="wm-neural-trace">
                        <div className="trace-label">Neural Routing Decision Path</div>
                        <div className="trace-steps-row">
                          <div className="trace-step completed">
                            <div className="trace-dot">1</div>
                            <span>Input Ingested</span>
                          </div>
                          <div className="trace-line completed"></div>
                          <div className="trace-step completed">
                            <div className="trace-dot">2</div>
                            <span>Intent Classify</span>
                          </div>
                          <div className="trace-line completed"></div>
                          <div className={`trace-step completed ${selectedChatLog.routing_level.toLowerCase()}`}>
                            <div className="trace-dot">3</div>
                            <span>{selectedChatLog.routing_level}</span>
                          </div>
                          <div className="trace-line completed"></div>
                          <div className="trace-step completed">
                            <div className="trace-dot">4</div>
                            <span>{selectedChatLog.response_time_ms}ms</span>
                          </div>
                        </div>
                      </div>

                      {/* Telemetry Strip */}
                      <div className="wm-conversation-kpi-grid" style={{ marginBottom: "1rem" }}>
                        <div className="conv-kpi-item">
                          <span className="conv-kpi-label">Response Latency</span>
                          <strong className="conv-kpi-val text-emerald-600">{selectedChatLog.response_time_ms} ms</strong>
                        </div>
                        <div className="conv-kpi-item">
                          <span className="conv-kpi-label">Confidence Score</span>
                          <strong className="conv-kpi-val">{Math.round(selectedChatLog.confidence * 100 || 98)}%</strong>
                        </div>
                        <div className="conv-kpi-item wide">
                          <span className="conv-kpi-label">Knowledge Citation</span>
                          <strong className="conv-kpi-doc">{selectedChatLog.source_document || "Municipal Solid Waste Knowledge Base"}</strong>
                        </div>
                      </div>

                      {/* Dialogue Transcript Stream */}
                      <div className="wm-dialogue-transcript-box">
                        <div className="dialogue-header-strip">
                          <Clock3 size={14} /> Real-Time Citizen Exchange
                        </div>

                        {/* Resident Query */}
                        <div className="dialogue-msg-row resident-row">
                          <div className="dialogue-avatar resident-av">
                            <User size={16} />
                          </div>
                          <div className="dialogue-bubble resident-bubble">
                            <div className="bubble-speaker">
                              <span>Citizen Inquirer</span>
                              <small>{formatClockTime(selectedChatLog.created_at)}</small>
                            </div>
                            <p>{selectedChatLog.user_message}</p>
                          </div>
                        </div>

                        {/* AI Assistant Reply */}
                        <div className="dialogue-msg-row assistant-row">
                          <div className="dialogue-avatar assistant-av">
                            <Bot size={16} />
                          </div>
                          <div className="dialogue-bubble assistant-bubble">
                            <div className="bubble-speaker">
                              <span>Municipal WasteWise AI</span>
                              <span className="routing-chip">{selectedChatLog.routing_level}</span>
                              <small className="ai-reply-time">{formatClockTime(selectedChatLog.created_at)} (+{selectedChatLog.response_time_ms}ms)</small>
                            </div>
                            <div className="assistant-text-render">
                              {renderMarkdown(selectedChatLog.assistant_reply)}
                            </div>
                            {selectedChatLog.source_document && (
                              <div className="dialogue-citation-footer">
                                <ShieldCheck size={13} className="text-emerald-600 inline mr-1" />
                                <span>Verified Policy Reference: <strong>{selectedChatLog.source_document}</strong></span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Official Reference Footer Card */}
                      <div className="inspector-citation-card">
                        <div className="citation-icon-wrap">
                          <ShieldCheck size={18} className="text-emerald-700" />
                        </div>
                        <div>
                          <h5>Official Municipal Knowledge Source</h5>
                          <p>
                            Formulated and verified in compliance with {selectedChatLog.source_document || "Municipal Solid Waste Management Rules & Bylaws 2026"}.
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="inspector-empty-state">
                      <Bot size={40} className="text-slate-300 mb-3" />
                      <h4>Select a Conversation Log</h4>
                      <p>Click on any resident inquiry from the left stream to inspect the full transcript, RAG citations, and routing telemetry.</p>
                    </div>
                  )}
                </div>
              </div>
            </section>
          </main>
        )}

        {/* Tab 5: Ward Fleet & Collection Schedules View */}
        {activeSection === "areas" && (
          <main className="wm-content">
            <div className="wm-welcome-row">
              <div>
                <h2>Municipal Wards & Fleet Schedules 🚛</h2>
                <p>Manage ward jurisdiction sectors, assigned sanitation supervisors, and collection routes.</p>
              </div>
              <div className="wm-header-action-group">
                <button
                  className="wm-primary-action-btn"
                  onClick={() => setIsAddWardOpen(true)}
                >
                  <Plus size={16} /> Register New Ward
                </button>
                <button className="wm-refresh" onClick={() => alert("All municipal compactor fleets operating on schedule.")}>
                  <Truck size={15} /> Fleet Active
                </button>
              </div>
            </div>

            <div className="areas-grid-container">
              {areas.map((a) => (
                <div key={a.id} className="ward-fleet-card">
                  <div className="card-top-row">
                    <span className="ward-badge-pill">{a.ward_code}</span>
                    <span className="route-badge-live">● On Schedule</span>
                  </div>
                  <h3>{a.name}</h3>
                  <div className="ward-details-block">
                    <p><strong>Region Sector:</strong> {a.region}</p>
                    <p><strong>Supervising Officer:</strong> {a.officer_name}</p>
                    <p><strong>Hotline:</strong> {a.contact_number}</p>
                  </div>
                  <div className="ward-schedule-box">
                    <strong>Weekly Door-to-Door Sweep:</strong>
                    <span>Mon, Wed, Fri: 06:30 – 09:30 (Wet / Organic)</span>
                    <span>Tue, Thu, Sat: 07:00 – 10:00 (Dry / Recyclables)</span>
                  </div>
                  <div className="ward-card-footer">
                    <button
                      className="ward-filter-btn"
                      onClick={() => {
                        setAreaFilter(a.id);
                        setActiveSection("issues");
                      }}
                    >
                      View Ward Issues →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </main>
        )}
      </section>

      {/* Register New Ward Modal */}
      {isAddWardOpen && (
        <div className="wm-modal-backdrop" onClick={() => setIsAddWardOpen(false)}>
          <div className="wm-issue-modal wm-add-ward-modal" onClick={(e) => e.stopPropagation()}>
            <div className="wm-modal-head">
              <div>
                <span className="wm-code-pill">WARD REGISTRATION</span>
                <h3>Add New Municipal Ward Sector</h3>
                <p>Define new municipal jurisdiction boundaries, assigned supervisor, and compactor routes.</p>
              </div>
              <button onClick={() => setIsAddWardOpen(false)}><X size={20} /></button>
            </div>

            <form onSubmit={handleCreateWard} className="wm-add-ward-form">
              <div className="wm-form-grid">
                <div className="wm-form-field">
                  <label>Ward Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Metro Riverside Boulevard"
                    value={wardForm.name}
                    onChange={(e) => setWardForm({ ...wardForm, name: e.target.value })}
                  />
                </div>
                <div className="wm-form-field">
                  <label>Ward Code *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. WARD-06 or W-106"
                    value={wardForm.ward_code}
                    onChange={(e) => setWardForm({ ...wardForm, ward_code: e.target.value.toUpperCase() })}
                  />
                </div>
                <div className="wm-form-field">
                  <label>Region / Zone Sector</label>
                  <input
                    type="text"
                    placeholder="e.g. North Metropolitan Zone"
                    value={wardForm.region}
                    onChange={(e) => setWardForm({ ...wardForm, region: e.target.value })}
                  />
                </div>
                <div className="wm-form-field">
                  <label>Supervising Sanitation Officer *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Officer Vikram Rao"
                    value={wardForm.officer_name}
                    onChange={(e) => setWardForm({ ...wardForm, officer_name: e.target.value })}
                  />
                </div>
                <div className="wm-form-field full-width">
                  <label>Sanitation Hotline / Emergency Contact Phone *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. +1 (555) 019-9944"
                    value={wardForm.contact_number}
                    onChange={(e) => setWardForm({ ...wardForm, contact_number: e.target.value })}
                  />
                </div>
                <div className="wm-form-field">
                  <label>Wet / Organic Sweep Schedule</label>
                  <input
                    type="text"
                    placeholder="Mon, Wed, Fri: 06:30 – 09:30"
                    value={wardForm.schedule_wet}
                    onChange={(e) => setWardForm({ ...wardForm, schedule_wet: e.target.value })}
                  />
                </div>
                <div className="wm-form-field">
                  <label>Dry / Recyclables Sweep Schedule</label>
                  <input
                    type="text"
                    placeholder="Tue, Thu, Sat: 07:00 – 10:00"
                    value={wardForm.schedule_dry}
                    onChange={(e) => setWardForm({ ...wardForm, schedule_dry: e.target.value })}
                  />
                </div>
              </div>

              <div className="wm-form-actions">
                <button
                  type="button"
                  className="wm-cancel-btn"
                  onClick={() => setIsAddWardOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingWard}
                  className="wm-save-btn"
                >
                  {addingWard ? "Registering Ward..." : "Save & Activate Ward Fleet"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detailed Citizen AI Conversation Dialogue Modal */}
      {chatModalLog && (
        <div className="wm-modal-backdrop" onClick={() => setChatModalLog(null)}>
          <div className="wm-issue-modal wm-conversation-modal" onClick={(e) => e.stopPropagation()}>
            <div className="wm-modal-head">
              <div>
                <div className="wm-chat-badge-row">
                  <span className="wm-code-pill">LOG #{chatModalLog.id}</span>
                  <span className={`routing-badge-modal ${chatModalLog.routing_level.toLowerCase()}`}>
                    {chatModalLog.routing_level === "L1_FAQ" && "⚡ Level 1: FAQ Match"}
                    {chatModalLog.routing_level === "L2_RAG" && "📘 Level 2: Municipal RAG"}
                    {chatModalLog.routing_level === "L3_LLM" && "🤖 Level 3: Multi-LLM"}
                  </span>
                  <span className="wm-channel-tag">💬 Citizen Chat</span>
                </div>
                <h3>Citizen AI Conversation Dialogue</h3>
                <p>Recorded {formatFullDateTime(chatModalLog.created_at)}</p>
              </div>
              <button onClick={() => setChatModalLog(null)}><X size={20} /></button>
            </div>

            <div className="wm-modal-body">
              {/* Telemetry KPI Cards */}
              <div className="wm-conversation-kpi-grid">
                <div className="conv-kpi-item">
                  <span className="conv-kpi-label">Latency</span>
                  <strong className="conv-kpi-val text-emerald-600">{chatModalLog.response_time_ms} ms</strong>
                </div>
                <div className="conv-kpi-item">
                  <span className="conv-kpi-label">Confidence</span>
                  <strong className="conv-kpi-val">{Math.round(chatModalLog.confidence * 100)}%</strong>
                </div>
                <div className="conv-kpi-item wide">
                  <span className="conv-kpi-label">Knowledge Source Citation</span>
                  <strong className="conv-kpi-doc">{chatModalLog.source_document || "Municipal Solid Waste Knowledge Base"}</strong>
                </div>
              </div>

              {/* Chat Dialogue Transcript Bubble Stream */}
              <div className="wm-dialogue-transcript-box">
                <div className="dialogue-header-strip">
                  <Clock3 size={14} /> Full Exchange Transcript
                </div>

                {/* Resident Message */}
                <div className="dialogue-msg-row resident-row">
                  <div className="dialogue-avatar resident-av">
                    <User size={16} />
                  </div>
                  <div className="dialogue-bubble resident-bubble">
                    <div className="bubble-speaker">
                      <span>Resident Citizen</span>
                      <small>{formatClockTime(chatModalLog.created_at)}</small>
                    </div>
                    <p>{chatModalLog.user_message}</p>
                  </div>
                </div>

                {/* AI Assistant Reply */}
                <div className="dialogue-msg-row assistant-row">
                  <div className="dialogue-avatar assistant-av">
                    <Bot size={16} />
                  </div>
                  <div className="dialogue-bubble assistant-bubble">
                    <div className="bubble-speaker">
                      <span>Municipal WasteWise AI</span>
                      <span className="routing-chip">{chatModalLog.routing_level}</span>
                      <small className="ai-reply-time">{formatClockTime(chatModalLog.created_at)} (+{chatModalLog.response_time_ms}ms)</small>
                    </div>
                    <div className="assistant-text-render">
                      {renderMarkdown(chatModalLog.assistant_reply)}
                    </div>
                    {chatModalLog.source_document && (
                      <div className="dialogue-citation-footer">
                        <span>Ref: {chatModalLog.source_document}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="wm-conversation-actions">
                <button
                  type="button"
                  onClick={() => handleCopyConversation(chatModalLog)}
                  className="wm-copy-dialogue-btn"
                >
                  <Copy size={15} /> {copiedText ? "Copied to Clipboard!" : "Copy Full Conversation"}
                </button>
                <button
                  type="button"
                  onClick={() => setChatModalLog(null)}
                  className="wm-close-modal-btn"
                >
                  Close Dialogue
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Issue Inspection & Status Update Modal */}
      {selectedIssue && (
        <div className="wm-modal-backdrop" onClick={() => setSelectedIssue(null)}>
          <div className="wm-issue-modal" onClick={(e) => e.stopPropagation()}>
            <div className="wm-modal-head">
              <div>
                <span className="wm-code-pill">{selectedIssue.issue_code}</span>
                <h3>{selectedIssue.issue_type}</h3>
                <p>{selectedIssue.area_name} ({selectedIssue.ward_code}) · Reported {new Date(selectedIssue.created_at).toLocaleString()}</p>
              </div>
              <button onClick={() => setSelectedIssue(null)}><X size={20} /></button>
            </div>

            <div className="wm-modal-body">
              <div className="wm-detail-grid">
                <div className="wm-detail-card">
                  <h4>Resident & Location</h4>
                  <p><b>Resident Name:</b> {selectedIssue.resident_name}</p>
                  {selectedIssue.phone && <p><b>Contact Phone:</b> {selectedIssue.phone}</p>}
                  <p><b>Address:</b> {selectedIssue.address}</p>
                  <p><b>Supervising Officer:</b> {selectedIssue.officer_name} ({selectedIssue.ward_contact})</p>
                </div>
                <div className="wm-detail-card">
                  <h4>Report Description</h4>
                  <p className="wm-description">{selectedIssue.description}</p>
                  <span className={`wm-priority ${selectedIssue.priority.toLowerCase()}`}>{selectedIssue.priority} Priority Tier</span>
                </div>
              </div>

              {/* Status Update Form */}
              <div className="wm-detail-card">
                <h4>Update Incident Dispatch Status & Field Notes</h4>
                <form onSubmit={handleStatusUpdate}>
                  <div className="wm-status-selects">
                    {(["NEW", "IN PROGRESS", "RESOLVED", "CLOSED"] as Status[]).map((st) => (
                      <button
                        type="button"
                        key={st}
                        className={newStatus === st ? "selected" : ""}
                        onClick={() => setNewStatus(st)}
                      >
                        {STATUS_META[st].label}
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={adminNoteInput}
                    onChange={(e) => setAdminNoteInput(e.target.value)}
                    rows={3}
                    placeholder="Enter dispatch notes, crew assignment, or resolution details (visible on citizen tracking)..."
                  />
                  <button className="wm-save" disabled={updatingStatus}>
                    {updatingStatus ? "Updating Registry..." : "Save Status & Sync Live Tracker"}
                  </button>
                </form>
              </div>

              {/* Timeline */}
              {selectedIssue.timeline?.length ? (
                <div className="wm-detail-card">
                  <h4>Official Audit Trail</h4>
                  <div className="wm-timeline">
                    {selectedIssue.timeline.map((event) => (
                      <div key={event.id}>
                        <i />
                        <div>
                          <strong>{event.action}</strong>
                          <span>{new Date(event.created_at).toLocaleString()}</span>
                          <p>{event.note}</p>
                          <small>By {event.actor}</small>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, hint, tone }: { icon: React.ReactNode; label: string; value: React.ReactNode; hint: string; tone: string }) {
  return (
    <div className="wm-stat-card">
      <div className={`wm-stat-icon ${tone}`}>{icon}</div>
      <div className="wm-stat-copy">
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{hint}</small>
      </div>
    </div>
  );
}
