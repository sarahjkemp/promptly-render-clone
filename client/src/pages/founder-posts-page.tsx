import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import AppLayout from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2, Sparkles, Copy, CheckCircle2, Scissors, Database } from "lucide-react";

interface FounderProfile {
  id: number;
  name: string;
  title: string;
  companyName: string;
  bio: string;
  voiceSummary: string;
  voiceRules: string;
  signatureMoves: string[];
  antiPatterns: string[];
  preferredTopics: string[];
  sensitiveTopics: string[];
  bannedWords: string[];
  approvedPhrases: string[];
  targetPeople: string[];
  contentGoals: string[];
}

interface FounderSource {
  id: number;
  founderId: number;
  title: string;
  sourceType: string;
  sourceUrl: string | null;
  rawText: string;
  isApprovedForReuse: boolean;
  createdAt: string;
}

interface FounderDraft {
  id: number;
  founderId: number;
  title: string;
  objective: string;
  audience: string;
  draftShape: string;
  selectedAngle: string;
  usedProofPoints: string[];
  riskFlags: string[];
  draftPrimary: string;
  draftHooks: string[];
  draftAltAngle: string | null;
  draftFirstComment: string | null;
  claimCheck: string[];
  status: "draft" | "approved";
  approvedVersion: string | null;
  editorNotes: string | null;
  updatedAt: string;
}

const emptyFounderForm = {
  name: "",
  title: "",
  companyName: "",
  bio: "",
  voiceSummary: "",
  voiceRules: "",
  signatureMoves: "",
  antiPatterns: "",
  preferredTopics: "",
  sensitiveTopics: "",
  bannedWords: "",
  approvedPhrases: "",
  targetPeople: "",
  contentGoals: "",
};

const emptySourceForm = {
  title: "",
  sourceType: "article",
  sourceUrl: "",
  rawText: "",
  isApprovedForReuse: true,
};

const emptyStudioForm = {
  objective: "authority",
  audience: "",
  draftShape: "contrarian mechanism",
  sensitivityNotes: "",
  rawInputTitle: "",
  rawInputText: "",
};

const FOUNDER_BACKUP_KEY = "promptly_founder_posts_backup_v1";

function listToTextarea(items: string[]) {
  return items.join("\n");
}

function textareaToList(value: string) {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function founderToForm(founder: FounderProfile) {
  return {
    name: founder.name || "",
    title: founder.title || "",
    companyName: founder.companyName || "",
    bio: founder.bio || "",
    voiceSummary: founder.voiceSummary || "",
    voiceRules: founder.voiceRules || "",
    signatureMoves: listToTextarea(founder.signatureMoves || []),
    antiPatterns: listToTextarea(founder.antiPatterns || []),
    preferredTopics: listToTextarea(founder.preferredTopics || []),
    sensitiveTopics: listToTextarea(founder.sensitiveTopics || []),
    bannedWords: listToTextarea(founder.bannedWords || []),
    approvedPhrases: listToTextarea(founder.approvedPhrases || []),
    targetPeople: listToTextarea(founder.targetPeople || []),
    contentGoals: listToTextarea(founder.contentGoals || []),
  };
}

export default function FounderPostsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedFounderId, setSelectedFounderId] = useState<number | null>(null);
  const [founderForm, setFounderForm] = useState(emptyFounderForm);
  const [sourceForm, setSourceForm] = useState(emptySourceForm);
  const [studioForm, setStudioForm] = useState(emptyStudioForm);
  const [selectedSourceIds, setSelectedSourceIds] = useState<number[]>([]);
  const [selectedDraft, setSelectedDraft] = useState<FounderDraft | null>(null);
  const [restoringBackup, setRestoringBackup] = useState(false);

  const { data: founders = [], isLoading: foundersLoading } = useQuery<FounderProfile[]>({
    queryKey: ["/api/founders"],
  });

  useEffect(() => {
    if (founders.length > 0) {
      localStorage.setItem(FOUNDER_BACKUP_KEY, JSON.stringify(founders));
    }
  }, [founders]);

  const selectedFounder = useMemo(
    () => founders.find((founder) => founder.id === selectedFounderId) || null,
    [founders, selectedFounderId]
  );

  useEffect(() => {
    if (!selectedFounderId && founders.length > 0) {
      setSelectedFounderId(founders[0].id);
    }
  }, [founders, selectedFounderId]);

  useEffect(() => {
    if (selectedFounder) {
      setFounderForm(founderToForm(selectedFounder));
    }
  }, [selectedFounder]);

  const { data: sources = [] } = useQuery<FounderSource[]>({
    queryKey: ["/api/founders", selectedFounderId, "sources"],
    queryFn: async () => {
      const response = await fetch(`/api/founders/${selectedFounderId}/sources`, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to load sources");
      return response.json();
    },
    enabled: !!selectedFounderId,
  });

  const { data: drafts = [] } = useQuery<FounderDraft[]>({
    queryKey: ["/api/founders", selectedFounderId, "drafts"],
    queryFn: async () => {
      const response = await fetch(`/api/founders/${selectedFounderId}/drafts`, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to load drafts");
      return response.json();
    },
    enabled: !!selectedFounderId,
  });

  const createFounderMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        ...founderForm,
        signatureMoves: textareaToList(founderForm.signatureMoves),
        antiPatterns: textareaToList(founderForm.antiPatterns),
        preferredTopics: textareaToList(founderForm.preferredTopics),
        sensitiveTopics: textareaToList(founderForm.sensitiveTopics),
        bannedWords: textareaToList(founderForm.bannedWords),
        approvedPhrases: textareaToList(founderForm.approvedPhrases),
        targetPeople: textareaToList(founderForm.targetPeople),
        contentGoals: textareaToList(founderForm.contentGoals),
      };
      const response = await fetch("/api/founders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error("Failed to create founder");
      return response.json();
    },
    onSuccess: (founder: FounderProfile) => {
      queryClient.invalidateQueries({ queryKey: ["/api/founders"] });
      setSelectedFounderId(founder.id);
      toast({ title: "Founder created", description: "Voice workspace is ready." });
    },
    onError: (error: Error) => {
      toast({ title: "Founder not created", description: error.message, variant: "destructive" });
    },
  });

  const saveFounderMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFounderId) throw new Error("Select a founder first");
      const payload = {
        ...founderForm,
        signatureMoves: textareaToList(founderForm.signatureMoves),
        antiPatterns: textareaToList(founderForm.antiPatterns),
        preferredTopics: textareaToList(founderForm.preferredTopics),
        sensitiveTopics: textareaToList(founderForm.sensitiveTopics),
        bannedWords: textareaToList(founderForm.bannedWords),
        approvedPhrases: textareaToList(founderForm.approvedPhrases),
        targetPeople: textareaToList(founderForm.targetPeople),
        contentGoals: textareaToList(founderForm.contentGoals),
      };
      const response = await fetch(`/api/founders/${selectedFounderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error("Failed to update founder");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/founders"] });
      toast({ title: "Founder updated", description: "Voice file saved." });
    },
    onError: (error: Error) => {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    },
  });

  const createSourceMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFounderId) throw new Error("Select a founder first");
      const response = await fetch(`/api/founders/${selectedFounderId}/sources`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(sourceForm),
      });
      if (!response.ok) throw new Error("Failed to save source");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/founders", selectedFounderId, "sources"] });
      setSourceForm(emptySourceForm);
      toast({ title: "Source saved", description: "Added to the founder source bank." });
    },
    onError: (error: Error) => {
      toast({ title: "Source not saved", description: error.message, variant: "destructive" });
    },
  });

  const deleteSourceMutation = useMutation({
    mutationFn: async (sourceId: number) => {
      if (!selectedFounderId) throw new Error("Select a founder first");
      const response = await fetch(`/api/founders/${selectedFounderId}/sources/${sourceId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to delete source");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/founders", selectedFounderId, "sources"] });
    },
  });

  const splitSourceMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFounderId) throw new Error("Select a founder first");
      const response = await fetch(`/api/founders/${selectedFounderId}/sources/split`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(sourceForm),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message || "Failed to split source");
      }
      return response.json();
    },
    onSuccess: (savedSeeds: FounderSource[]) => {
      queryClient.invalidateQueries({ queryKey: ["/api/founders", selectedFounderId, "sources"] });
      setSourceForm(emptySourceForm);
      toast({
        title: "Source split into post seeds",
        description: `${savedSeeds.length} new saved sources were added to the Source Bank.`,
      });
    },
    onError: (error: Error) => {
      toast({ title: "Split failed", description: error.message, variant: "destructive" });
    },
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFounderId) throw new Error("Create or select a founder first");
      const response = await fetch(`/api/founders/${selectedFounderId}/generate-post`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          sourceIds: selectedSourceIds,
          ...studioForm,
        }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message || "Failed to generate draft");
      }
      return response.json();
    },
    onSuccess: (draft: FounderDraft) => {
      queryClient.invalidateQueries({ queryKey: ["/api/founders", selectedFounderId, "drafts"] });
      setSelectedDraft(draft);
      toast({ title: "Draft generated", description: "Founder Post Engine has a new draft ready." });
    },
    onError: (error: Error) => {
      toast({ title: "Generation failed", description: error.message, variant: "destructive" });
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (draft: FounderDraft) => {
      const response = await fetch(`/api/founder-drafts/${draft.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          approvedVersion: draft.approvedVersion || draft.draftPrimary,
          editorNotes: draft.editorNotes || "",
          status: "approved",
        }),
      });
      if (!response.ok) throw new Error("Failed to approve draft");
      return response.json();
    },
    onSuccess: (draft: FounderDraft) => {
      queryClient.invalidateQueries({ queryKey: ["/api/founders", selectedFounderId, "drafts"] });
      setSelectedDraft(draft);
      toast({ title: "Draft approved", description: "Saved as an approved version." });
    },
  });

  const handleCopy = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    toast({ title: `${label} copied`, description: "Ready to paste." });
  };

  const backupFounders = useMemo(() => {
    try {
      const raw = localStorage.getItem(FOUNDER_BACKUP_KEY);
      if (!raw) return [] as FounderProfile[];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [] as FounderProfile[];
    }
  }, [founders.length]);

  const restoreLatestBackup = async () => {
    if (backupFounders.length === 0) return;
    setRestoringBackup(true);
    try {
      for (const backupFounder of backupFounders) {
        const payload = {
          name: backupFounder.name,
          title: backupFounder.title,
          companyName: backupFounder.companyName,
          bio: backupFounder.bio,
          voiceSummary: backupFounder.voiceSummary,
          voiceRules: backupFounder.voiceRules,
          signatureMoves: backupFounder.signatureMoves,
          antiPatterns: backupFounder.antiPatterns,
          preferredTopics: backupFounder.preferredTopics,
          sensitiveTopics: backupFounder.sensitiveTopics,
          bannedWords: backupFounder.bannedWords,
          approvedPhrases: backupFounder.approvedPhrases,
          targetPeople: backupFounder.targetPeople,
          contentGoals: backupFounder.contentGoals,
        };

        await fetch("/api/founders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        });
      }

      await queryClient.invalidateQueries({ queryKey: ["/api/founders"] });
      toast({
        title: "Founder backup restored",
        description: "Your latest local founder backup has been restored to the workspace.",
      });
    } catch (error) {
      toast({
        title: "Restore failed",
        description: error instanceof Error ? error.message : "Could not restore the founder backup.",
        variant: "destructive",
      });
    } finally {
      setRestoringBackup(false);
    }
  };

  return (
    <AppLayout title="Founder Posts">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">Founder Posts</h1>
        <p className="mt-2 text-sm text-gray-600">
          Build founder voice systems, store source material, and generate LinkedIn drafts with proof and risk checks.
        </p>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Select
          value={selectedFounderId ? String(selectedFounderId) : undefined}
          onValueChange={(value) => {
            setSelectedFounderId(Number(value));
            setSelectedDraft(null);
            setSelectedSourceIds([]);
          }}
        >
          <SelectTrigger className="w-[280px]">
            <SelectValue placeholder={foundersLoading ? "Loading founders..." : "Select founder"} />
          </SelectTrigger>
          <SelectContent>
            {founders.map((founder) => (
              <SelectItem key={founder.id} value={String(founder.id)}>
                {founder.name} {founder.companyName ? `· ${founder.companyName}` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {selectedFounder && (
          <>
            <Badge variant="secondary">{selectedFounder.title || "Founder"}</Badge>
            <Badge variant="outline">{selectedFounder.companyName || "No company set"}</Badge>
          </>
        )}
      </div>

      {!foundersLoading && founders.length === 0 && backupFounders.length > 0 && (
        <Alert className="mb-6">
          <AlertTitle>Saved founder backup found</AlertTitle>
          <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>
              The live founder workspace looks empty, but this browser has a saved backup of your founder profile data.
            </span>
            <Button variant="outline" onClick={restoreLatestBackup} disabled={restoringBackup}>
              {restoringBackup ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Restore backup
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="voice" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="voice">Voice</TabsTrigger>
          <TabsTrigger value="sources">Source Bank</TabsTrigger>
          <TabsTrigger value="studio">Studio</TabsTrigger>
          <TabsTrigger value="drafts">Drafts</TabsTrigger>
        </TabsList>

        <TabsContent value="voice" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{selectedFounder ? "Founder voice file" : "Create your first founder"}</CardTitle>
              <CardDescription>
                Capture the founder's voice, sharp edges, safe lanes, and recurring strategic themes.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <Input
                  placeholder="Founder name"
                  value={founderForm.name}
                  onChange={(event) => setFounderForm((prev) => ({ ...prev, name: event.target.value }))}
                />
                <Input
                  placeholder="Title"
                  value={founderForm.title}
                  onChange={(event) => setFounderForm((prev) => ({ ...prev, title: event.target.value }))}
                />
                <Input
                  placeholder="Company"
                  value={founderForm.companyName}
                  onChange={(event) => setFounderForm((prev) => ({ ...prev, companyName: event.target.value }))}
                />
              </div>

              <Textarea
                placeholder="Short bio"
                value={founderForm.bio}
                onChange={(event) => setFounderForm((prev) => ({ ...prev, bio: event.target.value }))}
              />
              <Textarea
                placeholder="Voice summary"
                value={founderForm.voiceSummary}
                onChange={(event) => setFounderForm((prev) => ({ ...prev, voiceSummary: event.target.value }))}
              />
              <Textarea
                placeholder="Voice rules"
                value={founderForm.voiceRules}
                onChange={(event) => setFounderForm((prev) => ({ ...prev, voiceRules: event.target.value }))}
              />

              <div className="grid gap-4 md:grid-cols-2">
                <Textarea
                  placeholder="Signature moves (one per line)"
                  value={founderForm.signatureMoves}
                  onChange={(event) => setFounderForm((prev) => ({ ...prev, signatureMoves: event.target.value }))}
                />
                <Textarea
                  placeholder="Anti-patterns (one per line)"
                  value={founderForm.antiPatterns}
                  onChange={(event) => setFounderForm((prev) => ({ ...prev, antiPatterns: event.target.value }))}
                />
                <Textarea
                  placeholder="Preferred topics (one per line)"
                  value={founderForm.preferredTopics}
                  onChange={(event) => setFounderForm((prev) => ({ ...prev, preferredTopics: event.target.value }))}
                />
                <Textarea
                  placeholder="Sensitive topics (one per line)"
                  value={founderForm.sensitiveTopics}
                  onChange={(event) => setFounderForm((prev) => ({ ...prev, sensitiveTopics: event.target.value }))}
                />
                <Textarea
                  placeholder="Banned words (one per line)"
                  value={founderForm.bannedWords}
                  onChange={(event) => setFounderForm((prev) => ({ ...prev, bannedWords: event.target.value }))}
                />
                <Textarea
                  placeholder="Approved phrases (one per line)"
                  value={founderForm.approvedPhrases}
                  onChange={(event) => setFounderForm((prev) => ({ ...prev, approvedPhrases: event.target.value }))}
                />
                <Textarea
                  placeholder="Target people / communities (one per line)"
                  value={founderForm.targetPeople}
                  onChange={(event) => setFounderForm((prev) => ({ ...prev, targetPeople: event.target.value }))}
                />
                <Textarea
                  placeholder="Content goals (one per line)"
                  value={founderForm.contentGoals}
                  onChange={(event) => setFounderForm((prev) => ({ ...prev, contentGoals: event.target.value }))}
                />
              </div>

              <div className="flex gap-3">
                {!selectedFounder ? (
                  <Button onClick={() => createFounderMutation.mutate()} disabled={createFounderMutation.isPending}>
                    {createFounderMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                    Create founder
                  </Button>
                ) : (
                  <Button onClick={() => saveFounderMutation.mutate()} disabled={saveFounderMutation.isPending}>
                    {saveFounderMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Save voice file
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

        </TabsContent>

        <TabsContent value="sources" className="space-y-6">
          {!selectedFounder ? (
            <Alert>
              <AlertTitle>Create a founder first</AlertTitle>
              <AlertDescription>
                The Source Bank lives here. Create the founder workspace first, then save source materials and post seeds underneath it.
              </AlertDescription>
            </Alert>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Source Bank</CardTitle>
                  <CardDescription>
                    Save one long source once, or split it into several reusable post seeds automatically.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Alert>
                    <Database className="h-4 w-4" />
                    <AlertTitle>This is where saved sources live</AlertTitle>
                    <AlertDescription>
                      Save full materials here, then use them later in Studio. For long documents like press releases, use <strong>Split into post seeds</strong>.
                    </AlertDescription>
                  </Alert>

                  <div className="grid gap-4 md:grid-cols-3">
                    <Input
                      placeholder="Source title"
                      value={sourceForm.title}
                      onChange={(event) => setSourceForm((prev) => ({ ...prev, title: event.target.value }))}
                    />
                    <Select
                      value={sourceForm.sourceType}
                      onValueChange={(value) => setSourceForm((prev) => ({ ...prev, sourceType: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Source type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="article">Article</SelectItem>
                        <SelectItem value="interview">Interview</SelectItem>
                        <SelectItem value="event-note">Event note</SelectItem>
                        <SelectItem value="pr-note">PR note</SelectItem>
                        <SelectItem value="voice-note">Voice note</SelectItem>
                        <SelectItem value="message">Message / chat</SelectItem>
                        <SelectItem value="press-release">Press release</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      placeholder="Optional source URL"
                      value={sourceForm.sourceUrl}
                      onChange={(event) => setSourceForm((prev) => ({ ...prev, sourceUrl: event.target.value }))}
                    />
                  </div>
                  <Textarea
                    placeholder="Paste the source text here"
                    value={sourceForm.rawText}
                    onChange={(event) => setSourceForm((prev) => ({ ...prev, rawText: event.target.value }))}
                    className="min-h-[220px]"
                  />
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={sourceForm.isApprovedForReuse}
                      onCheckedChange={(checked) => setSourceForm((prev) => ({ ...prev, isApprovedForReuse: checked === true }))}
                    />
                    <span className="text-sm text-gray-600">Approved for reuse in future drafts</span>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Button onClick={() => createSourceMutation.mutate()} disabled={createSourceMutation.isPending || splitSourceMutation.isPending}>
                      {createSourceMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                      Save source as-is
                    </Button>
                    <Button variant="outline" onClick={() => splitSourceMutation.mutate()} disabled={splitSourceMutation.isPending || createSourceMutation.isPending}>
                      {splitSourceMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Scissors className="mr-2 h-4 w-4" />}
                      Split into post seeds
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Saved sources</CardTitle>
                  <CardDescription>
                    Select these later in Studio when you want to generate a founder post.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {sources.map((source) => (
                    <div key={source.id} className="rounded-lg border border-gray-200 p-4">
                      <div className="mb-2 flex items-start justify-between gap-3">
                        <div>
                          <div className="font-medium text-gray-900">{source.title}</div>
                          <div className="mt-1 flex flex-wrap gap-2">
                            <Badge variant="secondary">{source.sourceType}</Badge>
                            {source.isApprovedForReuse && <Badge variant="outline">Reusable</Badge>}
                          </div>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => deleteSourceMutation.mutate(source.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="text-sm text-gray-600">{source.rawText.slice(0, 260)}{source.rawText.length > 260 ? "..." : ""}</p>
                    </div>
                  ))}
                  {sources.length === 0 && (
                    <p className="text-sm text-gray-500">No saved sources yet. Add one above, or split a long source into post seeds.</p>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="studio" className="space-y-6">
          {!selectedFounder ? (
            <Alert>
              <AlertTitle>Create a founder first</AlertTitle>
              <AlertDescription>
                Founder Post Engine needs a saved founder voice file before it can draft in-role.
              </AlertDescription>
            </Alert>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Generate a post</CardTitle>
                  <CardDescription>
                    Use saved sources, one-off raw material, or both. The system will infer angle, proof, and risk from what you give it.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Alert>
                    <AlertTitle>Missing a source?</AlertTitle>
                    <AlertDescription>
                      Saved sources live in the <strong>Source Bank</strong> tab. That is also where you can split one press release or transcript into multiple reusable post seeds.
                    </AlertDescription>
                  </Alert>
                  <div className="grid gap-4 md:grid-cols-3">
                    <Select
                      value={studioForm.objective}
                      onValueChange={(value) => setStudioForm((prev) => ({ ...prev, objective: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Objective" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="authority">Authority</SelectItem>
                        <SelectItem value="media attention">Media attention</SelectItem>
                        <SelectItem value="customer education">Customer education</SelectItem>
                        <SelectItem value="relationship-building">Relationship-building</SelectItem>
                        <SelectItem value="speaker positioning">Speaker positioning</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      placeholder="Primary audience"
                      value={studioForm.audience}
                      onChange={(event) => setStudioForm((prev) => ({ ...prev, audience: event.target.value }))}
                    />
                    <Select
                      value={studioForm.draftShape}
                      onValueChange={(value) => setStudioForm((prev) => ({ ...prev, draftShape: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Draft shape" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="contrarian mechanism">Contrarian mechanism</SelectItem>
                        <SelectItem value="field note">Field note</SelectItem>
                        <SelectItem value="myth vs reality">Myth vs reality</SelectItem>
                        <SelectItem value="response to current article">Response to current article</SelectItem>
                        <SelectItem value="event reflection">Event reflection</SelectItem>
                        <SelectItem value="media-targeting opinion post">Media-targeting opinion post</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Textarea
                    placeholder="Sensitivity notes"
                    value={studioForm.sensitivityNotes}
                    onChange={(event) => setStudioForm((prev) => ({ ...prev, sensitivityNotes: event.target.value }))}
                  />

                  <div>
                    <div className="mb-2 text-sm font-medium text-gray-900">Use saved sources</div>
                    <div className="space-y-2 rounded-lg border border-gray-200 p-4">
                      {sources.map((source) => (
                        <label key={source.id} className="flex items-start gap-3 text-sm text-gray-700">
                          <Checkbox
                            checked={selectedSourceIds.includes(source.id)}
                            onCheckedChange={(checked) => {
                              setSelectedSourceIds((prev) => checked === true ? [...prev, source.id] : prev.filter((id) => id !== source.id));
                            }}
                          />
                          <span>
                            <span className="font-medium">{source.title}</span>
                            <span className="block text-xs text-gray-500">{source.sourceType}</span>
                          </span>
                        </label>
                      ))}
                      {sources.length === 0 && <p className="text-sm text-gray-500">No saved sources yet. You can still paste raw material below.</p>}
                    </div>
                  </div>

                  <div className="grid gap-4">
                    <Input
                      placeholder="One-off raw input title"
                      value={studioForm.rawInputTitle}
                      onChange={(event) => setStudioForm((prev) => ({ ...prev, rawInputTitle: event.target.value }))}
                    />
                    <Textarea
                      placeholder="Paste raw source material here if you want a one-off draft"
                      value={studioForm.rawInputText}
                      onChange={(event) => setStudioForm((prev) => ({ ...prev, rawInputText: event.target.value }))}
                      className="min-h-[220px]"
                    />
                  </div>

                  <Button onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending}>
                    {generateMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                    Generate founder post
                  </Button>
                </CardContent>
              </Card>

              {selectedDraft && (
                <Card>
                  <CardHeader>
                    <CardTitle>{selectedDraft.title}</CardTitle>
                    <CardDescription>{selectedDraft.selectedAngle}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <div className="flex flex-wrap gap-2">
                      <Badge>{selectedDraft.objective}</Badge>
                      <Badge variant="outline">{selectedDraft.audience}</Badge>
                      <Badge variant="secondary">{selectedDraft.draftShape}</Badge>
                      {selectedDraft.status === "approved" && <Badge variant="default">Approved</Badge>}
                    </div>

                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <h3 className="font-medium text-gray-900">Hooks</h3>
                        <Button variant="ghost" size="sm" onClick={() => handleCopy(selectedDraft.draftHooks.join("\n"), "Hooks")}>
                          <Copy className="mr-2 h-4 w-4" />
                          Copy
                        </Button>
                      </div>
                      <div className="space-y-2">
                        {selectedDraft.draftHooks.map((hook, index) => (
                          <div key={index} className="rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-700">{hook}</div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <h3 className="font-medium text-gray-900">Primary draft</h3>
                        <Button variant="ghost" size="sm" onClick={() => handleCopy(selectedDraft.draftPrimary, "Draft")}>
                          <Copy className="mr-2 h-4 w-4" />
                          Copy
                        </Button>
                      </div>
                      <Textarea
                        value={selectedDraft.approvedVersion || selectedDraft.draftPrimary}
                        onChange={(event) => setSelectedDraft((prev) => prev ? ({ ...prev, approvedVersion: event.target.value }) : prev)}
                        className="min-h-[320px]"
                      />
                    </div>

                    {selectedDraft.draftAltAngle && (
                      <div>
                        <h3 className="mb-2 font-medium text-gray-900">Alternate angle</h3>
                        <p className="rounded-md bg-gray-50 px-3 py-3 text-sm text-gray-700">{selectedDraft.draftAltAngle}</p>
                      </div>
                    )}

                    {selectedDraft.draftFirstComment && (
                      <div>
                        <div className="mb-2 flex items-center justify-between">
                          <h3 className="font-medium text-gray-900">First comment</h3>
                          <Button variant="ghost" size="sm" onClick={() => handleCopy(selectedDraft.draftFirstComment || "", "First comment")}>
                            <Copy className="mr-2 h-4 w-4" />
                            Copy
                          </Button>
                        </div>
                        <p className="rounded-md bg-gray-50 px-3 py-3 text-sm text-gray-700">{selectedDraft.draftFirstComment}</p>
                      </div>
                    )}

                    <div className="grid gap-4 md:grid-cols-3">
                      <div>
                        <h3 className="mb-2 font-medium text-gray-900">Proof points</h3>
                        <ul className="space-y-2 text-sm text-gray-700">
                          {selectedDraft.usedProofPoints.map((item, index) => <li key={index}>• {item}</li>)}
                        </ul>
                      </div>
                      <div>
                        <h3 className="mb-2 font-medium text-gray-900">Risk flags</h3>
                        <ul className="space-y-2 text-sm text-gray-700">
                          {selectedDraft.riskFlags.length > 0 ? selectedDraft.riskFlags.map((item, index) => <li key={index}>• {item}</li>) : <li>• None flagged</li>}
                        </ul>
                      </div>
                      <div>
                        <h3 className="mb-2 font-medium text-gray-900">Claim check</h3>
                        <ul className="space-y-2 text-sm text-gray-700">
                          {selectedDraft.claimCheck.length > 0 ? selectedDraft.claimCheck.map((item, index) => <li key={index}>• {item}</li>) : <li>• No extra checks suggested</li>}
                        </ul>
                      </div>
                    </div>

                    <Textarea
                      placeholder="Editor notes"
                      value={selectedDraft.editorNotes || ""}
                      onChange={(event) => setSelectedDraft((prev) => prev ? ({ ...prev, editorNotes: event.target.value }) : prev)}
                    />

                    <Button onClick={() => approveMutation.mutate(selectedDraft)} disabled={approveMutation.isPending}>
                      {approveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                      Approve draft
                    </Button>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="drafts" className="space-y-4">
          {selectedFounder ? (
            drafts.length > 0 ? drafts.map((draft) => (
              <Card key={draft.id}>
                <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-medium text-gray-900">{draft.title}</h3>
                      <Badge variant={draft.status === "approved" ? "default" : "secondary"}>{draft.status}</Badge>
                    </div>
                    <p className="mt-2 text-sm text-gray-600">{draft.selectedAngle}</p>
                    <p className="mt-2 text-xs text-gray-500">Updated {new Date(draft.updatedAt).toLocaleString()}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setSelectedDraft(draft)}>Open</Button>
                    <Button variant="ghost" onClick={() => handleCopy(draft.approvedVersion || draft.draftPrimary, "Draft")}>
                      <Copy className="mr-2 h-4 w-4" />
                      Copy
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )) : (
              <p className="text-sm text-gray-500">No founder drafts yet.</p>
            )
          ) : (
            <Alert>
              <AlertTitle>No founder selected</AlertTitle>
              <AlertDescription>Create a founder workspace first.</AlertDescription>
            </Alert>
          )}
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}
