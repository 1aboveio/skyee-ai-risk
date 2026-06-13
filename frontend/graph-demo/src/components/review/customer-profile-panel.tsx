"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { WorkbenchPanel } from "./workbench-panel";
import {
  User,
  Building2,
  Globe,
  Phone,
  Mail,
  Shield,
  AlertTriangle,
  CheckCircle,
  Clock,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types (mirror API response)
// ---------------------------------------------------------------------------

interface CustomerProfile {
  custId: string;
  custType: "PERSONAL" | "COMPANY" | "UNKNOWN";
  custName: string | null;
  enName: string | null;
  custMobile: string | null;
  email: string | null;
  registCountry: string | null;
  custStatus: string | null;
  realnameStatus: string | null;
  riskLevel: string | null;
  riskScore: number | null;
  highRisk: boolean;
  sanctioned: boolean;
  regTime: string | null;
  personal: {
    name: string | null;
    enName: string | null;
    certType: string | null;
    certNo: string | null;
    residenceAddress: string | null;
  } | null;
  enterprise: {
    enterpriseName: string | null;
    enName: string | null;
    certNo: string | null;
    legalPersonName: string | null;
    businessStatus: string | null;
  } | null;
  freshness: {
    mainTable: { createTime: string | null; lastUpdateTime: string | null };
    realnameTable: { createTime: string | null; lastUpdateTime: string | null };
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function riskBadgeVariant(level: string | null): "default" | "destructive" | "secondary" | "outline" {
  switch (level?.toUpperCase()) {
    case "VERY_HIGH":
    case "CRITICAL":
      return "destructive";
    case "HIGH":
      return "destructive";
    case "MEDIUM":
      return "secondary";
    case "LOW":
      return "outline";
    default:
      return "outline";
  }
}

function statusBadgeVariant(status: string | null): "default" | "secondary" | "outline" {
  switch (status?.toUpperCase()) {
    case "ACTIVE":
      return "default";
    case "FROZEN":
    case "DISABLED":
      return "destructive";
    default:
      return "secondary";
  }
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "N/A";
  return new Date(iso).toLocaleString();
}

function maskCertNo(value: string | null): string {
  if (!value || value.length < 6) return value ?? "N/A";
  return `${value.slice(0, 3)}***${value.slice(-3)}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface CustomerProfilePanelProps {
  custId: string;
}

export function CustomerProfilePanel({ custId }: CustomerProfilePanelProps) {
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchProfile() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/review/${custId}/profile`);
        if (!response.ok) {
          if (response.status === 404) {
            if (!cancelled) {
              setProfile(null);
              setLoading(false);
            }
            return;
          }
          throw new Error("Failed to fetch customer profile");
        }

        const data = (await response.json()) as CustomerProfile;
        if (!cancelled) {
          setProfile(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unknown error");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchProfile();
    return () => {
      cancelled = true;
    };
  }, [custId]);

  return (
    <WorkbenchPanel
      title="Customer Profile"
      loading={loading}
      error={error}
      empty={!profile && !loading}
      emptyMessage="Customer profile data will be loaded from the Source Evidence Database."
    >
      {profile && <ProfileContent profile={profile} />}
    </WorkbenchPanel>
  );
}

function ProfileContent({ profile }: { profile: CustomerProfile }) {
  return (
    <div className="space-y-4">
      {/* Identity header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          {profile.custType === "COMPANY" ? (
            <Building2 className="h-5 w-5 text-muted-foreground shrink-0" />
          ) : (
            <User className="h-5 w-5 text-muted-foreground shrink-0" />
          )}
          <div>
            <h3 className="font-medium leading-tight">
              {profile.custName ?? "Unknown Name"}
            </h3>
            {profile.enName && (
              <p className="text-sm text-muted-foreground">{profile.enName}</p>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge variant={statusBadgeVariant(profile.custStatus)}>
            {profile.custStatus ?? "Unknown"}
          </Badge>
          <Badge variant="outline" className="text-xs">
            {profile.custType}
          </Badge>
        </div>
      </div>

      <Separator />

      {/* Risk summary */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">Risk Level</span>
          <Badge variant={riskBadgeVariant(profile.riskLevel)}>
            {profile.riskLevel ?? "N/A"}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {profile.highRisk ? (
            <AlertTriangle className="h-4 w-4 text-destructive" />
          ) : (
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="text-muted-foreground">High Risk</span>
          <span className="font-medium">
            {profile.highRisk ? "Yes" : "No"}
          </span>
        </div>
        {profile.riskScore !== null && (
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Score</span>
            <span className="font-medium">{profile.riskScore}</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          {profile.sanctioned ? (
            <AlertTriangle className="h-4 w-4 text-destructive" />
          ) : (
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="text-muted-foreground">Sanctioned</span>
          <span className="font-medium">
            {profile.sanctioned ? "Yes" : "No"}
          </span>
        </div>
      </div>

      <Separator />

      {/* Contact & registration */}
      <div className="space-y-2 text-sm">
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-muted-foreground w-24">Country</span>
          <span>{profile.registCountry ?? "N/A"}</span>
        </div>
        <div className="flex items-center gap-2">
          <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-muted-foreground w-24">Mobile</span>
          <span>{profile.custMobile ?? "N/A"}</span>
        </div>
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-muted-foreground w-24">Email</span>
          <span className="truncate">{profile.email ?? "N/A"}</span>
        </div>
        <div className="flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-muted-foreground w-24">KYC Status</span>
          <Badge variant={profile.realnameStatus === "VERIFIED" ? "default" : "secondary"}>
            {profile.realnameStatus ?? "Unknown"}
          </Badge>
        </div>
      </div>

      {/* Realname details */}
      {profile.personal && (
        <>
          <Separator />
          <div className="space-y-2 text-sm">
            <h4 className="font-medium text-xs text-muted-foreground uppercase tracking-wide">
              Identity Verification (Personal)
            </h4>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-muted-foreground">Name</span>
                <p>{profile.personal.name ?? "N/A"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Cert Type</span>
                <p>{profile.personal.certType ?? "N/A"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Cert No</span>
                <p>{maskCertNo(profile.personal.certNo)}</p>
              </div>
              <div className="col-span-2">
                <span className="text-muted-foreground">Address</span>
                <p className="text-xs">{profile.personal.residenceAddress ?? "N/A"}</p>
              </div>
            </div>
          </div>
        </>
      )}

      {profile.enterprise && (
        <>
          <Separator />
          <div className="space-y-2 text-sm">
            <h4 className="font-medium text-xs text-muted-foreground uppercase tracking-wide">
              Identity Verification (Enterprise)
            </h4>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-muted-foreground">Enterprise Name</span>
                <p>{profile.enterprise.enterpriseName ?? "N/A"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Legal Person</span>
                <p>{profile.enterprise.legalPersonName ?? "N/A"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Cert No</span>
                <p>{maskCertNo(profile.enterprise.certNo)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Business Status</span>
                <p>{profile.enterprise.businessStatus ?? "N/A"}</p>
              </div>
            </div>
          </div>
        </>
      )}

      <Separator />

      {/* Freshness metadata */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Clock className="h-3 w-3" />
        <span>
          Last updated: {formatDateTime(profile.freshness.mainTable.lastUpdateTime)}
        </span>
      </div>
    </div>
  );
}
