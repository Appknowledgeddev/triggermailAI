import {
  Activity,
  Bot,
  CircleDollarSign,
  FileText,
  Gauge,
  Inbox,
  LayoutDashboard,
  LogOut,
  Settings,
  Users,
  Webhook,
  Zap,
} from "lucide-react";

export const workspaceNavItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Flows", href: "/flows", icon: Zap },
  { label: "Templates", href: "/templates", icon: FileText },
  { label: "Triggers", href: "/triggers", icon: Webhook },
  { label: "Mailhooks", href: "/mailhooks", icon: Inbox },
  { label: "Audiences", href: "/audiences", icon: Users },
  { label: "Insights", href: "/insights", icon: Gauge },
  { label: "Activity", href: "/activity", icon: Activity, badge: "4" },
  { label: "AI Studio", href: "/ai-studio", icon: Bot },
];

export const accountNavItems = [
  { label: "Billing", href: "/billing", icon: CircleDollarSign },
  { label: "Settings", href: "/settings", icon: Settings },
  { label: "Logout", href: "/login", icon: LogOut },
];

export const flowRows = [
  {
    name: "Inbound lead nurture",
    trigger: "Webhook",
    status: "Running",
    sent: "12,840",
    rate: "74%",
    color: "bg-violet-brand",
  },
  {
    name: "Recruitment welcome",
    trigger: "Form submission",
    status: "Drafting",
    sent: "4,210",
    rate: "68%",
    color: "bg-blue-action",
  },
  {
    name: "Support reply summary",
    trigger: "Mailhook",
    status: "Running",
    sent: "2,936",
    rate: "59%",
    color: "bg-green-success",
  },
];

export const activityRows = [
  { title: "Webhook received", meta: "Property enquiry flow", time: "2 min ago", type: "Trigger" },
  { title: "AI draft generated", meta: "Recruitment welcome email", time: "9 min ago", type: "AI Draft" },
  { title: "Email clicked", meta: "Book a consultation CTA", time: "18 min ago", type: "Insight" },
  { title: "Run failed", meta: "Missing company variable", time: "34 min ago", type: "Run" },
];

export const templateRows = [
  { name: "Welcome sequence", type: "Lifecycle", updated: "Today", usage: "8 flows" },
  { name: "Quote follow-up", type: "Sales", updated: "Yesterday", usage: "5 flows" },
  { name: "Candidate introduction", type: "Recruitment", updated: "Jun 17", usage: "3 flows" },
  { name: "Invoice reminder", type: "Finance", updated: "Jun 16", usage: "4 flows" },
];

export const triggerRows = [
  { name: "New property enquiry", type: "Webhook", endpoint: "/webhook/prop_lead_42", runs: "1,284" },
  { name: "Recruitment form", type: "Form submission", endpoint: "/forms/recruitment", runs: "842" },
  { name: "Nightly digest", type: "Schedule", endpoint: "Every weekday 08:00", runs: "126" },
];

export const audienceRows = [
  { name: "SaaS founders", contacts: "8,420", tags: "trial, product-led", health: "Clean" },
  { name: "Recruitment agencies", contacts: "3,160", tags: "agency, hiring", health: "Clean" },
  { name: "Property enquiries", contacts: "2,940", tags: "lead, valuation", health: "Review" },
];
