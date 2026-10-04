"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  MessageSquare,
  Bot,
  X,
  Minus,
  Send,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Sparkles,
  Building2,
  CheckCircle2,
  AlertTriangle,
  Upload,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Search,
  Copy,
  Check,
  RotateCcw,
  Clock,
  ChevronRight,
  ArrowRight,
  HelpCircle,
  MapPin,
  Flame,
  CornerDownLeft,
  Maximize2,
  Minimize2,
  Phone,
} from "lucide-react";
import { fetchApi, ChatResponse, ComplaintPayload, ComplaintResponse, Area, TrackingData } from "../lib/api";

interface Message {
  id: string;
  sender: "bot" | "user";
  text: string;
  level?: "L1_FAQ" | "L2_RAG" | "L3_LLM";
  latency?: number;
  sourceDoc?: string;
  timestamp: string;
  isIssueForm?: boolean;
  isTrackingPrompt?: boolean;
  trackingData?: TrackingData | null;
  followUps?: string[];
  confirmationData?: {
    issueCode: string;
    status: string;
    message: string;
    residentName: string;
    issueType: string;
    phone?: string;
    smsSent?: boolean;
    smsMessage?: string;
  };
}

interface ChatWidgetProps {
  areas: Area[];
  onOpenTracker?: (code: string) => void;
}

export default function ChatWidget({ areas, onOpenTracker }: ChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [inputMessage, setInputMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [speechEnabled, setSpeechEnabled] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentlySpeakingMsgId, setCurrentlySpeakingMsgId] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [lastSubmittedCode, setLastSubmittedCode] = useState<string | null>(null);
  const [selectedAreaId, setSelectedAreaId] = useState<number>(201);
  const [inlineTrackingInput, setInlineTrackingInput] = useState("");

  const initialMessages: Message[] = [
    {
      id: "intro-1",
      sender: "bot",
      text: "👋 **Welcome to Waste Management AI.**",
      timestamp: "Just now",
    },
    {
      id: "intro-2",
      sender: "bot",
      text: "I am your direct link to municipal sanitation operations. I provide verified support for **waste segregation**, **door-to-door schedules**, **bylaws & penalties**, and **live complaint tracking**.\n\nHow can I help you keep our city clean today?",
      timestamp: "Just now",
      followUps: [
        "🔍 Issue Tracking",
        "🚨 Report Waste Issue",
      ],
    },
  ];

  const [messages, setMessages] = useState<Message[]>(initialMessages);

  // Issue reporting form state inside chat
  const [reportingStep, setReportingStep] = useState<number | null>(null);
  const [formData, setFormData] = useState<ComplaintPayload>({
    resident_name: "",
    phone: "",
    address: "",
    area_id: 201,
    issue_type: "Overflowing Bin",
    description: "",
    photo_url: null,
    priority: "Medium",
  });
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [submittingIssue, setSubmittingIssue] = useState(false);
  const [copiedTrackingCode, setCopiedTrackingCode] = useState<string | null>(null);

  const handleCopyTrackingCode = (code: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(code);
      setCopiedTrackingCode(code);
      setTimeout(() => setCopiedTrackingCode(null), 2500);
    }
  };

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // On initial open, stay at the top so citizen sees the greeting without jumping the page
  useEffect(() => {
    if (isOpen && !isMinimized && messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = 0;
    }
  }, [isOpen]);

  // Only auto-scroll when new messages arrive beyond the initial greeting, or during reporting
  useEffect(() => {
    if (isOpen && !isMinimized && messages.length > 2) {
      if (messagesContainerRef.current) {
        messagesContainerRef.current.scrollTo({
          top: messagesContainerRef.current.scrollHeight,
          behavior: "smooth",
        });
      }
    }
  }, [messages, reportingStep]);

  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);

  // Preload system & neural voices
  useEffect(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      const updateVoices = () => {
        const list = window.speechSynthesis.getVoices();
        if (list && list.length > 0) {
          setAvailableVoices(list);
        }
      };
      updateVoices();
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }
  }, []);

  // Human-like voice synthesis with emojis and markdown titles stripped out
  const cleanTextForHumanSpeech = (text: string): string => {
    let clean = text;
    // Remove citation codes and references
    clean = clean.replace(/\[Official Citation:[^\]]*\]/gi, "");
    clean = clean.replace(/\[Ref:[^\]]*\]/gi, "");
    clean = clean.replace(/Ref:[^\n]*/gi, "");

    // Remove introductory titles/headers (e.g., "Municipal Disposal Guidance for '...':", "Waste Segregation Guide: ...", etc.)
    clean = clean.replace(/^.*?(Municipal Disposal Guidance|Environmental Standard|Waste Segregation Guide|Sanitation Guidance|Overview|Directive|Protocol).*?\n/gim, "");

    // Remove all emojis and unicode icons
    clean = clean.replace(/[\u{1F300}-\u{1F9FF}\u{1FA00}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F000}-\u{1F02F}\u{1F0A0}-\u{1F0FF}]/gu, "");

    // Remove markdown formatting
    clean = clean.replace(/[*_#`~>]/g, "");

    // Clean bullet points so they flow naturally as spoken sentences
    clean = clean.replace(/^[•\-\*]\s+/gm, "");
    clean = clean.replace(/\n+[•\-\*]\s+/g, ". ");

    // Remove URLs
    clean = clean.replace(/https?:\/\/\S+/g, "");

    // Normalize spacing and punctuation pauses
    clean = clean.replace(/:\s*\n/g, ". ");
    clean = clean.replace(/\n+/g, ". ");
    clean = clean.replace(/\s+/g, " ");
    clean = clean.replace(/\.+/g, ".");

    return clean.trim();
  };

  const speakText = (text: string, msgId?: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    // If already speaking, stop playback immediately
    if (isSpeaking || window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
      const wasThisMessage = msgId && currentlySpeakingMsgId === msgId;
      setIsSpeaking(false);
      setCurrentlySpeakingMsgId(null);
      if (wasThisMessage) {
        return;
      }
    }

    if (!speechEnabled) return;

    const speechReadyText = cleanTextForHumanSpeech(text);
    if (!speechReadyText) return;

    const utterance = new SpeechSynthesisUtterance(speechReadyText);
    const voices = availableVoices.length > 0 ? availableVoices : window.speechSynthesis.getVoices();
    
    const preferredFemaleNames = [
      "Microsoft Jenny Online (Natural) - English (United States)",
      "Microsoft Aria Online (Natural) - English (United States)",
      "Microsoft Michelle Online (Natural) - English (United States)",
      "Microsoft Ava Online (Natural) - English (United States)",
      "Microsoft Emma Online (Natural) - English (United States)",
      "Microsoft Sonia Online (Natural) - English (United Kingdom)",
      "Microsoft Libby Online (Natural) - English (United Kingdom)",
      "Microsoft Neerja Online (Natural) - English (India)",
      "Google US English",
      "Google UK English Female",
      "Microsoft Zira - English (United States)",
      "Samantha",
      "Victoria",
      "Karen",
      "Serena",
      "Moira"
    ];

    let selectedVoice: SpeechSynthesisVoice | undefined;

    for (const name of preferredFemaleNames) {
      selectedVoice = voices.find((v) => v.name.toLowerCase().includes(name.toLowerCase()));
      if (selectedVoice) break;
    }

    if (!selectedVoice) {
      selectedVoice = voices.find(
        (v) =>
          v.lang.startsWith("en") &&
          (v.name.toLowerCase().includes("natural") ||
           v.name.toLowerCase().includes("online") ||
           v.name.toLowerCase().includes("female") ||
           v.name.toLowerCase().includes("woman") ||
           v.name.toLowerCase().includes("zira") ||
           v.name.toLowerCase().includes("jenny") ||
           v.name.toLowerCase().includes("aria"))
      );
    }

    if (!selectedVoice) {
      selectedVoice = voices.find((v) => v.lang.startsWith("en"));
    }

    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }

    utterance.pitch = 1.0;
    utterance.rate = 0.98;
    utterance.volume = 1.0;

    utterance.onstart = () => {
      setIsSpeaking(true);
      if (msgId) setCurrentlySpeakingMsgId(msgId);
    };

    utterance.onend = () => {
      setIsSpeaking(false);
      setCurrentlySpeakingMsgId(null);
    };

    utterance.onerror = () => {
      setIsSpeaking(false);
      setCurrentlySpeakingMsgId(null);
    };

    window.speechSynthesis.speak(utterance);
  };

  // Web Speech recognition
  const startVoiceInput = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition is supported in Google Chrome and Microsoft Edge.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onerror = () => {
      setListening(false);
    };
    recognition.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript;
      if (transcript) {
        handleSendMessage(transcript, true);
      }
    };

    recognition.start();
  };

  const handleCopyCode = (code: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2500);
    }
  };

  const handleResetChat = () => {
    if (confirm("Reset conversation and start fresh?")) {
      setMessages(initialMessages);
      setReportingStep(null);
      setInputMessage("");
      setInlineTrackingInput("");
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    }
  };

  const handleSendMessage = async (customText?: string, isVoice = false) => {
    const text = (customText || inputMessage).trim();
    if (!text || loading) return;

    // Check if the user specifically asked for "Issue Tracking" without an ID
    const cleanLower = text.toLowerCase();
    if (cleanLower === "issue tracking" || cleanLower === "🔍 issue tracking" || cleanLower === "track issue") {
      setMessages((prev) => [
        ...prev,
        {
          id: `user-${Date.now()}`,
          sender: "user",
          text: "🔍 Issue Tracking",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
        {
          id: `bot-${Date.now()}`,
          sender: "bot",
          text: "🔍 **Municipal Sanitation Issue Tracking**\n\nPlease provide your **Tracking ID** below to look up real-time dispatch progress, assigned inspection officers, and resolution notes.",
          isTrackingPrompt: true,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          followUps: lastSubmittedCode ? [`Track ${lastSubmittedCode}`] : undefined,
        },
      ]);
      if (!customText) setInputMessage("");
      return;
    }

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      sender: "user",
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    const currentHistory = [...messages, userMsg]
      .filter((m) => m.sender === "user" || m.sender === "bot")
      .map((m) => ({
        role: m.sender === "user" ? "user" : "assistant",
        text: m.text,
      }));

    setMessages((prev) => [...prev, userMsg]);
    if (!customText) setInputMessage("");
    setLoading(true);

    try {
      const endpoint = isVoice ? "/api/voice/process" : "/api/chat";
      const res = await fetchApi<ChatResponse>(endpoint, {
        method: "POST",
        body: JSON.stringify({
          message: text,
          area_id: selectedAreaId,
          history: currentHistory,
        }),
      });

      const shouldTriggerReport = Boolean(res.trigger_report_flow);

      if (res.tracking_data?.issue_code) {
        setLastSubmittedCode(res.tracking_data.issue_code);
      }

      const botMsg: Message = {
        id: `bot-${Date.now()}`,
        sender: "bot",
        text: res.reply,
        level: res.level,
        latency: res.response_time_ms,
        sourceDoc: res.source_document,
        isIssueForm: shouldTriggerReport,
        trackingData: res.tracking_data,
        followUps: res.follow_ups,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((prev) => [...prev, botMsg]);

      if (shouldTriggerReport) {
        setReportingStep(1);
        const lower = text.toLowerCase();
        let detectedType = "Overflowing Bin";
        if (lower.includes("not collected") || lower.includes("missed") || lower.includes("didn't come")) {
          detectedType = "Garbage Not Collected";
        } else if (lower.includes("dumping") || lower.includes("dumped") || lower.includes("debris")) {
          detectedType = "Illegal Dumping";
        } else if (lower.includes("broken") || lower.includes("damage") || lower.includes("lid")) {
          detectedType = "Broken Equipment";
        } else if (lower.includes("hazard") || lower.includes("needle") || lower.includes("chemical")) {
          detectedType = "Hazardous Waste";
        }

        setFormData((prev) => ({
          ...prev,
          description: text,
          area_id: selectedAreaId || prev.area_id || 201,
          issue_type: detectedType,
        }));
      }

      if (isVoice && speechEnabled) {
        speakText(res.reply);
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `bot-err-${Date.now()}`,
          sender: "bot",
          text: "I am temporarily having trouble reaching the municipal network. Please verify that the local server is running.",
          timestamp: "Now",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const triggerQuickAction = (action: string) => {
    if (action === "Issue Tracking" || action === "🔍 Issue Tracking") {
      setMessages((prev) => [
        ...prev,
        {
          id: `user-track-${Date.now()}`,
          sender: "user",
          text: "🔍 Issue Tracking",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
        {
          id: `bot-track-prompt-${Date.now()}`,
          sender: "bot",
          text: "🔍 **Municipal Sanitation Issue Tracking**\n\nPlease enter your **Tracking ID** below to look up real-time dispatch progress, assigned inspection officers, and resolution notes.",
          isTrackingPrompt: true,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          followUps: lastSubmittedCode ? [`Track ${lastSubmittedCode}`] : undefined,
        },
      ]);
      return;
    }

    if (action === "Report Waste Issue" || action === "🚨 Report Waste Issue") {
      setReportingStep(1);
      setMessages((prev) => [
        ...prev,
        {
          id: `user-action-${Date.now()}`,
          sender: "user",
          text: "Report Waste Issue",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
        {
          id: `bot-action-${Date.now()}`,
          sender: "bot",
          text: "I will guide you through lodging a formal municipal waste complaint. Please fill in the details below to dispatch a sanitation unit.",
          isIssueForm: true,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
      return;
    }

    if (action === "Garbage Not Collected") {
      handleSendMessage("My morning garbage has not been collected today. What should I do?");
    } else if (action === "Overflowing Bin") {
      handleSendMessage("There is an overflowing public bin spilling waste on the road.");
    } else if (action === "Illegal Dumping") {
      handleSendMessage("What is the penalty for illegal dumping and how do I report roadside debris?");
    } else if (action === "Home Composting" || action === "Home Composting Guide") {
      handleSendMessage("How can I start home composting?");
    } else {
      handleSendMessage(action);
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      setPhotoPreview(base64);
      setFormData((prev) => ({ ...prev, photo_url: base64 }));
    };
    reader.readAsDataURL(file);
  };

  const submitComplaintReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.resident_name || !formData.address || !formData.description) {
      alert("Please fill in the required details: Name, Address, and Description.");
      return;
    }

    setSubmittingIssue(true);
    try {
      const res = await fetchApi<ComplaintResponse>("/api/complaints", {
        method: "POST",
        body: JSON.stringify(formData),
      });

      setReportingStep(null);
      setPhotoPreview(null);
      setLastSubmittedCode(res.issue_code);

      const confirmMsg: Message = {
        id: `confirm-${Date.now()}`,
        sender: "bot",
        text: `✅ **Complaint Registered Successfully!**\n\nYour official **Tracking ID is \`${res.issue_code}\`**.\n\n📋 **Please copy and save this Tracking ID.** You can use it anytime to track real-time crew dispatch and live resolution progress.`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        confirmationData: {
          issueCode: res.issue_code,
          status: res.status,
          message: res.message,
          residentName: formData.resident_name,
          issueType: formData.issue_type,
          phone: formData.phone || undefined,
        },
        followUps: [`Track ${res.issue_code}`, "Ward Helpline", "Home Composting"],
      };

      setMessages((prev) => [...prev, confirmMsg]);

      // Reset form
      setFormData({
        resident_name: "",
        phone: "",
        address: "",
        area_id: selectedAreaId,
        issue_type: "Overflowing Bin",
        description: "",
        photo_url: null,
        priority: "Medium",
      });
    } catch (err: any) {
      alert("Failed to submit complaint: " + err.message);
    } finally {
      setSubmittingIssue(false);
    }
  };

  // Render clickable text with tracking IDs, bold, italic, and inline code
  const renderFormattedText = (text: string) => {
    return (
      <div className="message-text-content">
        {text.split("\n\n").map((paragraph, pIdx) => {
          const lines = paragraph.split("\n");
          return (
            <p key={pIdx} className="message-paragraph">
              {lines.map((line, lIdx) => {
                const parts = line.split(/(WMIS-\d{4}-\d{3,6}|\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
                return (
                  <React.Fragment key={lIdx}>
                    {parts.map((part, partIdx) => {
                      if (/^WMIS-\d{4}-\d{3,6}$/i.test(part)) {
                        return (
                          <button
                            key={partIdx}
                            type="button"
                            onClick={() => handleSendMessage(`Track ${part}`)}
                            className="clickable-tracking-code"
                            title="Click to track this issue status"
                          >
                            <ShieldCheck className="w-3 h-3 inline mr-1" />
                            {part}
                          </button>
                        );
                      }
                      if (part.startsWith("**") && part.endsWith("**")) {
                        return <strong key={partIdx}>{part.slice(2, -2)}</strong>;
                      }
                      if (part.startsWith("*") && part.endsWith("*")) {
                        return <em key={partIdx}>{part.slice(1, -1)}</em>;
                      }
                      if (part.startsWith("`") && part.endsWith("`")) {
                        const codeVal = part.slice(1, -1);
                        if (/^WMIS-\d{4}-\d{3,6}$/i.test(codeVal)) {
                          return (
                            <button
                              key={partIdx}
                              type="button"
                              onClick={() => handleSendMessage(`Track ${codeVal}`)}
                              className="clickable-tracking-code"
                              title="Click to track this issue status"
                            >
                              <ShieldCheck className="w-3 h-3 inline mr-1" />
                              {codeVal}
                            </button>
                          );
                        }
                        return <code key={partIdx} className="inline-code">{codeVal}</code>;
                      }
                      return part;
                    })}
                    {lIdx < lines.length - 1 && <br />}
                  </React.Fragment>
                );
              })}
            </p>
          );
        })}
      </div>
    );
  };

  // Render Visual Interactive Live Tracker Card inside chat bubble
  const renderLiveTrackerCard = (t: TrackingData) => {
    const steps = [
      { label: "Lodged", key: "NEW" },
      { label: "Inspected", key: "IN PROGRESS" },
      { label: "Crew Active", key: "IN PROGRESS" },
      { label: "Resolved", key: "RESOLVED" },
    ];
    
    const isResolved = t.status === "RESOLVED";
    const isClosed = t.status === "CLOSED";
    const isInProgress = t.status === "IN PROGRESS";

    const getStepStatus = (index: number) => {
      if (isClosed || isResolved) return "completed";
      if (isInProgress) {
        if (index <= 1) return "completed";
        if (index === 2) return "active";
        return "pending";
      }
      return index === 0 ? "active" : "pending";
    };

    return (
      <div className="live-tracker-card">
        <div className="tracker-card-header">
          <div className="tracker-id-box">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span className="tracker-code-text">{t.issue_code}</span>
          </div>
          <span className={`status-badge-pill status-${t.status.toLowerCase().replace(" ", "-")}`}>
            {t.status === "NEW" && "● Registered"}
            {t.status === "IN PROGRESS" && "⚡ In Progress"}
            {t.status === "RESOLVED" && "✓ Resolved"}
            {t.status === "CLOSED" && "Closed"}
          </span>
        </div>

        {/* 4-Step Stepper */}
        <div className="tracker-stepper">
          {steps.map((st, i) => {
            const state = getStepStatus(i);
            return (
              <div key={i} className={`tracker-step-item ${state}`}>
                <div className="step-dot">{state === "completed" ? "✓" : i + 1}</div>
                <span className="step-text">{st.label}</span>
                {i < steps.length - 1 && <div className="step-line" />}
              </div>
            );
          })}
        </div>

        {/* Details Grid */}
        <div className="tracker-details-grid">
          <div className="grid-cell">
            <span className="cell-label">Category</span>
            <span className="cell-value">{t.issue_type}</span>
          </div>
          <div className="grid-cell">
            <span className="cell-label">Priority</span>
            <span className="cell-value priority-tag">{t.priority || "Medium"}</span>
          </div>
          <div className="grid-cell full-width">
            <span className="cell-label">Address</span>
            <span className="cell-value">{t.address}</span>
          </div>
          {t.area_name && (
            <div className="grid-cell full-width">
              <span className="cell-label">Ward Sector</span>
              <span className="cell-value">{t.area_name} ({t.ward_code || "Municipal Zone"})</span>
            </div>
          )}
          {t.officer_name && (
            <div className="grid-cell full-width">
              <span className="cell-label">Assigned Officer</span>
              <span className="cell-value">{t.officer_name} {t.ward_contact ? `(${t.ward_contact})` : ""}</span>
            </div>
          )}
        </div>

        {/* Admin / Crew Notes */}
        {t.admin_notes && (
          <div className="tracker-crew-note">
            <span className="note-title">Field Crew Update:</span>
            <p className="note-content">{t.admin_notes}</p>
          </div>
        )}

        {/* Actions */}
        <div className="tracker-action-buttons">
          <button
            type="button"
            onClick={() => handleCopyCode(t.issue_code)}
            className="tracker-copy-btn"
            title="Copy Tracking ID to clipboard"
          >
            {copiedCode === t.issue_code ? (
              <>
                <Check className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 mr-1" />
                Copy ID
              </>
            )}
          </button>
          {onOpenTracker && (
            <button
              type="button"
              onClick={() => onOpenTracker(t.issue_code)}
              className="tracker-modal-btn"
              title="Open full tracking modal with audit history"
            >
              <ExternalLink className="w-3.5 h-3.5 mr-1" />
              Full Audit Trail
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Modern Floating Chat Launcher Button (Icon Only, No Name Text) */}
      {!isOpen && (
        <div className="floating-chat-launcher-wrapper">
          <button
            onClick={() => {
              setIsOpen(true);
              setIsMinimized(false);
            }}
            className="modern-floating-chat-icon-btn"
            aria-label="Open Municipal Waste AI Assistant"
            title="Open Municipal Waste Assistant"
          >
            <div className="btn-glow-aura" />
            <img
              src="/chatbot-icon.png"
              alt="Municipal Waste AI Assistant"
              className="chatbot-launcher-img"
            />
          </button>
        </div>
      )}

      {/* Floating Chat Panel (High-End Glassmorphic Shell) */}
      {isOpen && (
        <aside
          className={`chat-widget-panel modern-glass-shell ${isMinimized ? "minimized" : ""} ${isFullScreen ? "fullscreen" : ""}`}
          aria-label="Civic AI Chat Assistant"
        >
          {/* Header */}
          <header className="chat-header modern-header">
            <div className="chat-header-info">
              <div className="civic-avatar-box waste-robot-avatar">
                <img
                  src="/chatbot-icon.png"
                  alt="Waste Management AI"
                  className="civic-avatar-img"
                />
                <span className="avatar-active-ring" />
              </div>
              <div>
                <div className="chat-title-row">
                  <h3 className="chat-title">Waste Management AI</h3>
                  <span className="ai-version-chip">v2.6</span>
                </div>
                <div className="chat-online-status">
                  <span className="status-dot-pulse" />
                  <span>3-Level Routing · Public Services Online</span>
                </div>
              </div>
            </div>

            <div className="chat-header-controls">
              <button
                type="button"
                onClick={() => {
                  if (isSpeaking || (typeof window !== "undefined" && window.speechSynthesis?.speaking)) {
                    window.speechSynthesis.cancel();
                    setIsSpeaking(false);
                    setCurrentlySpeakingMsgId(null);
                  }
                  setIsOpen(false);
                }}
                className="control-btn close-btn"
                title="Close"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </header>

          {!isMinimized && (
            <>
              {/* Ward Location Pill Bar */}
              <div className="chat-ward-bar modern-ward-bar">
                <div className="ward-label-wrap">
                  <MapPin className="w-3 h-3 text-emerald-600 mr-1" />
                  <span>Your Ward Sector:</span>
                </div>
                <select
                  id="chat-ward-select"
                  value={selectedAreaId}
                  onChange={(e) => {
                    const id = Number(e.target.value);
                    setSelectedAreaId(id);
                    setFormData((prev) => ({ ...prev, area_id: id }));
                  }}
                  className="modern-ward-select"
                >
                  {areas.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.ward_code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Messages Container */}
              <div className="chat-messages-container modern-messages-scroll" ref={messagesContainerRef}>
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`message-bubble-row ${msg.sender === "user" ? "user-row" : "bot-row"}`}
                  >
                    <div className={`message-bubble ${msg.sender} modern-bubble`}>
                      {renderFormattedText(msg.text)}

                      {/* Natural Speech Playback Action for Bot Replies */}
                      {msg.sender === "bot" && !msg.isIssueForm && (
                        <div className="bot-speech-action-row">
                          <button
                            type="button"
                            onClick={() => speakText(msg.text, msg.id)}
                            className={`tts-speak-btn ${currentlySpeakingMsgId === msg.id ? "speaking" : ""}`}
                            title={currentlySpeakingMsgId === msg.id ? "Stop voice playback" : "Listen to answer"}
                          >
                            {currentlySpeakingMsgId === msg.id ? (
                              <>
                                <VolumeX className="w-3.5 h-3.5 text-rose-500 animate-pulse" />
                                <span className="tts-btn-label text-rose-500 font-medium">Stop</span>
                              </>
                            ) : (
                              <>
                                <Volume2 className="w-3.5 h-3.5 text-slate-400 hover:text-emerald-600" />
                                <span className="tts-btn-label">Listen</span>
                              </>
                            )}
                          </button>
                        </div>
                      )}

                      {/* Dedicated Interactive Tracking Input Card when user clicks Issue Tracking */}
                      {msg.isTrackingPrompt && (
                        <div className="chat-tracking-entry-card">
                          <div className="entry-card-header">
                            <Search className="w-3.5 h-3.5 text-sky-600 mr-1.5" />
                            <span>Lookup by Tracking ID</span>
                          </div>
                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              if (!inlineTrackingInput.trim()) return;
                              handleSendMessage(`Track ${inlineTrackingInput.trim()}`);
                              setInlineTrackingInput("");
                            }}
                            className="tracking-entry-form"
                          >
                            <div className="tracking-entry-input-wrap">
                              <input
                                type="text"
                                placeholder="Enter ID (e.g. WMIS-2026-0101)..."
                                value={inlineTrackingInput}
                                onChange={(e) => setInlineTrackingInput(e.target.value)}
                                className="tracking-entry-input"
                              />
                              <button
                                type="submit"
                                disabled={!inlineTrackingInput.trim()}
                                className="tracking-entry-submit"
                              >
                                <span>Track</span>
                                <ArrowRight className="w-3 h-3 ml-1" />
                              </button>
                            </div>
                          </form>
                          {lastSubmittedCode && (
                            <div className="recent-tracking-suggestion">
                              <span className="recent-label">Your recently filed ticket:</span>
                              <button
                                type="button"
                                onClick={() => handleSendMessage(`Track ${lastSubmittedCode}`)}
                                className="recent-code-btn"
                              >
                                <ShieldCheck className="w-3 h-3 mr-1 text-emerald-600" />
                                {lastSubmittedCode}
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Render Visual Live Tracker Card if returned from issue tracking */}
                      {msg.trackingData && renderLiveTrackerCard(msg.trackingData)}

                      {/* Suggested Follow-up Chips */}
                      {msg.followUps && msg.followUps.length > 0 && !msg.isIssueForm && (
                        <div className="followup-chips-container">
                          {msg.followUps.map((chip, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => triggerQuickAction(chip)}
                              className="followup-chip"
                            >
                              <span>{chip}</span>
                              <ChevronRight className="w-3 h-3 ml-0.5 opacity-50" />
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Interactive Guided Report Form */}
                      {msg.isIssueForm && reportingStep !== null && (
                        <form onSubmit={submitComplaintReport} className="interactive-report-card">
                          <div className="form-header">
                            <AlertTriangle className="w-4 h-4 text-amber-500" />
                            <strong>Lodge Official Sanitation Complaint</strong>
                          </div>

                          <div className="field-group">
                            <label>1. Resident Name *</label>
                            <input
                              type="text"
                              required
                              placeholder="e.g. Priya Sharma"
                              value={formData.resident_name}
                              onChange={(e) =>
                                setFormData({ ...formData, resident_name: e.target.value })
                              }
                            />
                          </div>

                          <div className="field-group">
                            <label>2. Contact Phone (Optional)</label>
                            <input
                              type="tel"
                              placeholder="e.g. 9876543210"
                              value={formData.phone}
                              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            />
                          </div>

                          <div className="field-group">
                            <label>3. Exact Street Address *</label>
                            <input
                              type="text"
                              required
                              placeholder="e.g. 14 Riverside Blvd, near Gate 2"
                              value={formData.address}
                              onChange={(e) =>
                                setFormData({ ...formData, address: e.target.value })
                              }
                            />
                          </div>

                          <div className="field-group">
                            <label>4. Issue Category *</label>
                            <select
                              value={formData.issue_type}
                              onChange={(e) =>
                                setFormData({ ...formData, issue_type: e.target.value })
                              }
                            >
                              <option value="Overflowing Bin">Overflowing Bin</option>
                              <option value="Garbage Not Collected">Garbage Not Collected</option>
                              <option value="Illegal Dumping">Illegal Dumping</option>
                              <option value="Broken Equipment">Broken Bin / Equipment</option>
                              <option value="Hazardous Waste">Hazardous / Biomedical Waste</option>
                            </select>
                          </div>

                          <div className="field-group">
                            <label>5. Description *</label>
                            <textarea
                              rows={2}
                              required
                              placeholder="Describe the issue for the dispatch crew..."
                              value={formData.description}
                              onChange={(e) =>
                                setFormData({ ...formData, description: e.target.value })
                              }
                            />
                          </div>

                          <div className="field-group">
                            <label>6. Optional Photo Evidence</label>
                            <div className="photo-upload-box">
                              <input
                                type="file"
                                id="chat-photo"
                                accept="image/*"
                                onChange={handlePhotoUpload}
                                className="hidden-file-input"
                              />
                              <label htmlFor="chat-photo" className="photo-upload-label">
                                <Upload className="w-4 h-4 mr-1.5 text-slate-500" />
                                {photoPreview ? "Change Photo" : "Upload Photo"}
                              </label>
                            </div>
                            {photoPreview && (
                              <div className="photo-thumbnail-container">
                                <img
                                  src={photoPreview}
                                  alt="Preview"
                                  className="photo-thumbnail"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    setPhotoPreview(null);
                                    setFormData({ ...formData, photo_url: null });
                                  }}
                                  className="remove-photo-btn"
                                >
                                  Remove
                                </button>
                              </div>
                            )}
                          </div>

                          <div className="form-action-row">
                            <button
                              type="button"
                              onClick={() => setReportingStep(null)}
                              className="cancel-form-btn"
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              disabled={submittingIssue}
                              className="submit-report-btn"
                            >
                              {submittingIssue ? "Registering..." : "Submit Complaint"}
                            </button>
                          </div>
                        </form>
                      )}

                      {/* Confirmation Card after submission */}
                      {msg.confirmationData && (
                        <div className="complaint-confirmation-card">
                          <div className="confirm-top">
                            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                            <div>
                              <h4>Complaint Registered Successfully</h4>
                              <p className="confirm-sub">Your issue has been logged with Municipal Dispatch</p>
                            </div>
                          </div>

                          {/* Prominent Copy Tracking ID Box */}
                          <div className="tracking-id-highlight-box">
                            <div className="tracking-id-text-group">
                              <span className="tracking-id-label">OFFICIAL TRACKING ID</span>
                              <span className="tracking-id-number">{msg.confirmationData.issueCode}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleCopyTrackingCode(msg.confirmationData!.issueCode)}
                              className={`copy-tracking-pill-btn ${copiedTrackingCode === msg.confirmationData.issueCode ? "copied" : ""}`}
                              title="Copy Tracking ID"
                            >
                              {copiedTrackingCode === msg.confirmationData.issueCode ? (
                                <>
                                  <Check className="w-4 h-4 text-emerald-600 mr-1" />
                                  <span className="text-emerald-700 font-semibold">Copied!</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-4 h-4 text-slate-600 mr-1" />
                                  <span>Copy ID</span>
                                </>
                              )}
                            </button>
                          </div>

                          <div className="tracking-notice-callout">
                            <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                            <p>
                              <strong>Please copy and save your Tracking ID.</strong> You can use it to track live crew dispatch and resolution updates anytime.
                            </p>
                          </div>

                          <div className="confirm-details">
                            <p>
                              <strong>Resident:</strong> {msg.confirmationData.residentName}
                            </p>
                            <p>
                              <strong>Category:</strong> {msg.confirmationData.issueType}
                            </p>
                            <p>
                              <strong>Status:</strong>{" "}
                              <span className="status-pill-new">
                                {msg.confirmationData.status}
                              </span>
                            </p>
                          </div>
                          <div className="confirm-actions-row">
                            <button
                              type="button"
                              onClick={() => handleSendMessage(`Track ${msg.confirmationData!.issueCode}`)}
                              className="view-tracking-btn primary"
                            >
                              <Search className="w-3.5 h-3.5 mr-1" />
                              Track Status Here
                            </button>
                            {onOpenTracker && (
                              <button
                                type="button"
                                onClick={() =>
                                  onOpenTracker(msg.confirmationData!.issueCode)
                                }
                                className="view-tracking-btn secondary"
                              >
                                <ExternalLink className="w-3.5 h-3.5 mr-1" />
                                Full Portal
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {loading && (
                  <div className="message-bubble-row bot-row">
                    <div className="message-bubble bot thinking-bubble modern-bubble">
                      <div className="typing-dots">
                        <span />
                        <span />
                        <span />
                      </div>
                      <span className="thinking-text">Querying municipal RAG knowledge base...</span>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Chat Input Bar (Floating Modern Bar) */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="chat-input-bar modern-input-bar"
              >
                <input
                  type="text"
                  placeholder="Ask a waste question or enter Tracking ID (e.g. WMIS-2026-0101)..."
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  disabled={loading}
                  className="modern-chat-input"
                />
                <button
                  type="submit"
                  disabled={!inputMessage.trim() || loading}
                  className="chat-send-btn modern-send-btn"
                  aria-label="Send message"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>

              {/* Civic / Legal Disclaimer */}
              <footer className="chat-footer-disclaimer modern-disclaimer">
                Verified against Municipal Solid Waste Bylaws & RAG Knowledge Base 2026.
              </footer>
            </>
          )}
        </aside>
      )}
    </>
  );
}
