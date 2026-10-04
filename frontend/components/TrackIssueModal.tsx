"use client";

import React, { useState, useEffect } from "react";
import { X, Search, Clock, CheckCircle, AlertCircle, MapPin, User, Phone, ShieldCheck, ChevronRight } from "lucide-react";
import { fetchApi, ComplaintDetail } from "../lib/api";

interface TrackIssueModalProps {
  initialCode?: string;
  onClose: () => void;
}

export default function TrackIssueModal({ initialCode = "", onClose }: TrackIssueModalProps) {
  const [code, setCode] = useState(initialCode);
  const [loading, setLoading] = useState(false);
  const [complaint, setComplaint] = useState<ComplaintDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleLookup = async (lookupCode: string) => {
    const trimmed = lookupCode.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchApi<ComplaintDetail>(`/api/complaints/track/${trimmed}`);
      setComplaint(data);
    } catch (err: any) {
      setError(err.message || "No issue found with this code. Please verify.");
      setComplaint(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialCode) {
      handleLookup(initialCode);
    }
  }, [initialCode]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "NEW":
        return <span className="status-badge badge-new">● Registered (NEW)</span>;
      case "IN PROGRESS":
        return <span className="status-badge badge-progress">⚡ In Progress</span>;
      case "RESOLVED":
        return <span className="status-badge badge-resolved">✓ Resolved</span>;
      case "CLOSED":
        return <span className="status-badge badge-closed">Closed</span>;
      default:
        return <span className="status-badge">{status}</span>;
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-window" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-box">
            <ShieldCheck className="w-5 h-5 text-emerald-700" />
            <div>
              <h3>Municipal Issue Tracking Portal</h3>
              <p>Real-time status & dispatch audit trail</p>
            </div>
          </div>
          <button onClick={onClose} className="modal-close-btn" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="modal-body">
          {/* Search Box */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleLookup(code);
            }}
            className="tracking-search-bar"
          >
            <input
              type="text"
              placeholder="Enter Tracking ID (e.g. WMIS-2026-0101)"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            <button type="submit" disabled={loading || !code.trim()} className="track-btn">
              <Search className="w-4 h-4 mr-1" />
              {loading ? "Searching..." : "Track Status"}
            </button>
          </form>

          {error && (
            <div className="error-alert">
              <AlertCircle className="w-5 h-5 mr-2 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          {complaint && (
            <div className="tracking-results">
              {/* Top Summary Card */}
              <div className="result-card-header">
                <div>
                  <span className="result-code-tag">{complaint.issue_code}</span>
                  <h4 className="result-issue-title">{complaint.issue_type}</h4>
                  <p className="result-location">
                    <MapPin className="w-3.5 h-3.5 inline mr-1 text-slate-400" />
                    {complaint.address} · {complaint.area_name} ({complaint.ward_code})
                  </p>
                </div>
                <div>{getStatusBadge(complaint.status)}</div>
              </div>

              {/* Grid Information */}
              <div className="result-grid">
                <div className="result-field">
                  <span className="field-label">Resident Name</span>
                  <span className="field-value">{complaint.resident_name}</span>
                </div>
                <div className="result-field">
                  <span className="field-label">Priority Level</span>
                  <span className={`priority-tag ${complaint.priority.toLowerCase()}`}>
                    {complaint.priority}
                  </span>
                </div>
                <div className="result-field">
                  <span className="field-label">Reported On</span>
                  <span className="field-value">
                    {new Date(complaint.created_at).toLocaleString()}
                  </span>
                </div>
                <div className="result-field">
                  <span className="field-label">Ward Officer Contact</span>
                  <span className="field-value">
                    {complaint.officer_name} ({complaint.ward_contact})
                  </span>
                </div>
              </div>

              {/* Description */}
              <div className="description-box">
                <h5>Resident Description</h5>
                <p>{complaint.description}</p>
              </div>

              {/* Photo Preview if attached */}
              {complaint.photo_url && (
                <div className="attached-photo-box">
                  <h5>Attached Photographic Evidence</h5>
                  <img
                    src={complaint.photo_url}
                    alt="Citizen uploaded evidence"
                    className="evidence-image"
                  />
                </div>
              )}

              {/* Admin Notes */}
              {complaint.admin_notes && (
                <div className="admin-notes-card">
                  <h5>Official Municipal Remarks</h5>
                  <p>{complaint.admin_notes}</p>
                </div>
              )}

              {/* Timeline */}
              <div className="audit-timeline-section">
                <h5>Status & Dispatch Audit Timeline</h5>
                <div className="timeline-flow">
                  {complaint.timeline && complaint.timeline.length > 0 ? (
                    complaint.timeline.map((item, idx) => (
                      <div key={item.id || idx} className="timeline-step">
                        <div className="timeline-marker">
                          <span className="marker-dot" />
                          {idx < complaint.timeline!.length - 1 && <span className="marker-line" />}
                        </div>
                        <div className="timeline-content">
                          <div className="timeline-title-row">
                            <strong>{item.action}</strong>
                            <span className="timeline-date">
                              {new Date(item.created_at).toLocaleString([], {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                          <p className="timeline-note">{item.note}</p>
                          <span className="timeline-actor">By: {item.actor}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-slate-400 text-sm">No timeline logs recorded yet.</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
