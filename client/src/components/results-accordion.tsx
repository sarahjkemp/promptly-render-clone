import * as React from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Loader2,
  Copy,
  ChevronDown,
  ChevronRight,
  FileText,
  MessageSquare,
  List,
  Mail,
  Users,
  Save,
  Edit3,
  Package,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import MediaTargetsTab from "@/components/media-targets-tab";
import SourceIndicator from "@/components/SourceIndicator";

// Type definitions for PR content - matching the results page interface
interface AccordionPRContent {
  summary: string | null;
  angles: Array<{ headline: string; paragraph: string }> | null;
  outline: string[] | null;
  article: { title: string; content: string } | null;
  email: { subject: string; body: string } | null;
  publishingPack: string | null;
}

interface ResultsAccordionProps {
  prContent: AccordionPRContent | null;
  article: any;
  articleId: string | null;
  contentError: any;
  isRefetchingContent: boolean;
  refetchContent: () => void;
}

// Section configuration
// Define all sections, filtering based on feature flags
const getAllSections = () => {
  const baseSections = [
    {
      id: "summary",
      title: "Article Summary",
      icon: FileText,
      description: "Key insights and main points",
    },
    {
      id: "angles",
      title: "Commentary Angles",
      icon: MessageSquare,
      description: "Newsworthy perspectives and hooks",
    },
    {
      id: "outline",
      title: "Thought Leadership Outline",
      icon: List,
      description: "Structure for opinion pieces",
    },
    {
      id: "article",
      title: "Thought Leadership Post",
      icon: FileText,
      description: "Complete 600-800 word article draft",
    },
    {
      id: "email",
      title: "Pitch Email Draft",
      icon: Mail,
      description: "Ready-to-send journalist outreach",
    },
    {
      id: "publishing_pack",
      title: "Publishing Pack",
      icon: Package,
      description: "SEO metadata and structured data",
    },
  ];

  // Add outreach section if feature flag is enabled
  if (import.meta.env.VITE_OUTREACH_UI !== "false") {
    baseSections.push({
      id: "media-targets",
      title: "Outreach Targets",
      icon: Users,
      description: "Relevant journalists and publications",
    });
  }

  return baseSections;
};

export default function ResultsAccordion({
  prContent,
  article,
  articleId,
  contentError,
  isRefetchingContent,
  refetchContent,
}: ResultsAccordionProps) {
  const { toast } = useToast();

  // State for editable content
  const [editableArticle, setEditableArticle] = useState({
    title: prContent?.article?.title || "",
    content: prContent?.article?.content || "",
  });
  const [editableEmail, setEditableEmail] = useState({
    subject: prContent?.email?.subject || "",
    body: prContent?.email?.body || "",
  });

  // Track which sections are being edited
  const [isEditingArticle, setIsEditingArticle] = useState(false);
  const [isEditingEmail, setIsEditingEmail] = useState(false);

  // Track if content has been modified
  const [articleModified, setArticleModified] = useState(false);
  const [emailModified, setEmailModified] = useState(false);

  // Update editable content when prContent changes
  React.useEffect(() => {
    if (prContent?.article && !isEditingArticle) {
      setEditableArticle({
        title: prContent.article.title,
        content: prContent.article.content,
      });
    }
    if (prContent?.email && !isEditingEmail) {
      setEditableEmail({
        subject: prContent.email.subject,
        body: prContent.email.body,
      });
    }
  }, [prContent, isEditingArticle, isEditingEmail]);

  const [openSections, setOpenSections] = useState<Set<string>>(
    new Set(["summary"]),
  );

  // Save handlers
  const handleSaveArticle = async () => {
    if (!articleId) return;

    try {
      const response = await fetch(
        `/api/articles/${articleId}/pr-content/article`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ content: editableArticle }),
        },
      );

      if (!response.ok) {
        throw new Error("Failed to save article");
      }

      setIsEditingArticle(false);
      setArticleModified(false);

      // Invalidate the query to refresh the data
      queryClient.invalidateQueries({
        queryKey: ["/api/articles", articleId, "pr-content"],
      });

      toast({
        title: "Article saved",
        description: "Your changes have been saved successfully.",
      });
    } catch (error) {
      toast({
        title: "Save failed",
        description: "Unable to save changes. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleSaveEmail = async () => {
    if (!articleId) return;

    try {
      const response = await fetch(
        `/api/articles/${articleId}/pr-content/email`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ content: editableEmail }),
        },
      );

      if (!response.ok) {
        throw new Error("Failed to save email");
      }

      setIsEditingEmail(false);
      setEmailModified(false);

      // Invalidate the query to refresh the data
      queryClient.invalidateQueries({
        queryKey: ["/api/articles", articleId, "pr-content"],
      });

      toast({
        title: "Email saved",
        description: "Your changes have been saved successfully.",
      });
    } catch (error) {
      toast({
        title: "Save failed",
        description: "Unable to save changes. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Cancel editing handlers
  const handleCancelArticleEdit = () => {
    setEditableArticle({
      title: prContent?.article?.title || "",
      content: prContent?.article?.content || "",
    });
    setIsEditingArticle(false);
    setArticleModified(false);
  };

  const handleCancelEmailEdit = () => {
    setEditableEmail({
      subject: prContent?.email?.subject || "",
      body: prContent?.email?.body || "",
    });
    setIsEditingEmail(false);
    setEmailModified(false);
  };

  // Toggle section open/closed
  const toggleSection = (sectionId: string) => {
    const newOpenSections = new Set(openSections);
    if (newOpenSections.has(sectionId)) {
      newOpenSections.delete(sectionId);
    } else {
      newOpenSections.add(sectionId);
    }
    setOpenSections(newOpenSections);
  };

  // Copy content to clipboard
  const copyContent = (content: string, type: string) => {
    navigator.clipboard.writeText(content);
    toast({ title: `${type} copied to clipboard` });
  };

  // Render loading skeleton
  const renderLoadingSkeleton = () => (
    <div className="space-y-2">
      <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4"></div>
      <div className="h-4 bg-gray-200 rounded animate-pulse w-1/2"></div>
      <div className="h-4 bg-gray-200 rounded animate-pulse w-2/3"></div>
    </div>
  );

  // Render error state
  const renderError = (sectionType: string) => (
    <div className="flex items-center justify-between p-4 bg-red-50 border border-red-200 rounded-md">
      <div>
        <p className="text-red-800 font-medium">Failed to load {sectionType}</p>
        <p className="text-red-600 text-sm">
          Please try refreshing the content
        </p>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={refetchContent}
        disabled={isRefetchingContent}
        className="text-red-700 border-red-300 hover:bg-red-100"
      >
        {isRefetchingContent ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          "Retry"
        )}
      </Button>
    </div>
  );

  // Render section content
  const renderSectionContent = (sectionId: string) => {
    if (contentError) {
      return renderError(sectionId);
    }

    if (!prContent) {
      return renderLoadingSkeleton();
    }

    switch (sectionId) {
      case "summary":
        return prContent.summary ? (
          <div className="prose max-w-none">
            <p className="text-gray-700 leading-relaxed">{prContent.summary}</p>
            <SourceIndicator />
          </div>
        ) : (
          renderLoadingSkeleton()
        );

      case "angles":
        return prContent.angles && prContent.angles.length > 0 ? (
          <div className="space-y-4">
            {prContent.angles.map((angle, index) => (
              <div
                key={index}
                className="p-4 bg-gray-50 rounded-md border border-gray-200"
              >
                <h3 className="font-medium text-gray-900 mb-2">
                  {angle.headline}
                </h3>
                <p className="text-gray-700 whitespace-pre-line leading-relaxed">
                  {angle.paragraph}
                </p>
              </div>
            ))}
            <SourceIndicator />
          </div>
        ) : (
          renderLoadingSkeleton()
        );

      case "outline":
        return prContent.outline && prContent.outline.length > 0 ? (
          <div>
            <ul className="list-disc pl-5 space-y-3">
              {prContent.outline.map((item, index) => (
                <li key={index} className="text-gray-700 leading-relaxed">
                  {item}
                </li>
              ))}
            </ul>
            <SourceIndicator />
          </div>
        ) : (
          renderLoadingSkeleton()
        );

      case "article":
        return prContent.article ? (
          <div className="space-y-4">
            {/* Fact-check reminder */}
            <div className="bg-blue-50 border-l-4 border-blue-300 p-4 rounded-r-md">
              <p className="text-blue-800 text-sm">
                <span className="font-medium">
                  Please verify content before publishing.
                </span>{" "}
                AI-generated material should be reviewed for accuracy and
                fact-checked against reliable sources.
              </p>
            </div>

            {isEditingArticle ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Article Title
                  </label>
                  <Input
                    value={editableArticle.title}
                    onChange={(e) => {
                      setEditableArticle((prev) => ({
                        ...prev,
                        title: e.target.value,
                      }));
                      setArticleModified(true);
                    }}
                    placeholder="Enter article title..."
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Article Content
                  </label>
                  <Textarea
                    value={editableArticle.content}
                    onChange={(e) => {
                      setEditableArticle((prev) => ({
                        ...prev,
                        content: e.target.value,
                      }));
                      setArticleModified(true);
                    }}
                    placeholder="Enter article content..."
                    rows={16}
                    className="w-full min-h-[400px] resize-y"
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleSaveArticle} size="sm">
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </Button>
                  <Button
                    onClick={handleCancelArticleEdit}
                    variant="outline"
                    size="sm"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {prContent.article.title}
                  </h3>
                  <Button
                    onClick={() => setIsEditingArticle(true)}
                    variant="outline"
                    size="sm"
                  >
                    <Edit3 className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                </div>
                <div className="prose max-w-none">
                  <p className="text-gray-700 whitespace-pre-line leading-relaxed">
                    {prContent.article.content}
                  </p>
                </div>
                <SourceIndicator />
              </div>
            )}
          </div>
        ) : (
          renderLoadingSkeleton()
        );

      case "email":
        return prContent.email ? (
          <div className="space-y-4">
            {/* Fact-check reminder */}
            <div className="bg-blue-50 border-l-4 border-blue-300 p-4 rounded-r-md">
              <p className="text-blue-800 text-sm">
                <span className="font-medium">
                  Please verify content before publishing.
                </span>{" "}
                AI-generated material should be reviewed for accuracy and
                fact-checked against reliable sources.
              </p>
            </div>

            {isEditingEmail ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Subject
                  </label>
                  <Input
                    value={editableEmail.subject}
                    onChange={(e) => {
                      setEditableEmail((prev) => ({
                        ...prev,
                        subject: e.target.value,
                      }));
                      setEmailModified(true);
                    }}
                    placeholder="Enter email subject..."
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Body
                  </label>
                  <Textarea
                    value={editableEmail.body}
                    onChange={(e) => {
                      setEditableEmail((prev) => ({
                        ...prev,
                        body: e.target.value,
                      }));
                      setEmailModified(true);
                    }}
                    placeholder="Enter email body..."
                    rows={12}
                    className="w-full min-h-[300px] resize-y"
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleSaveEmail} size="sm">
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </Button>
                  <Button
                    onClick={handleCancelEmailEdit}
                    variant="outline"
                    size="sm"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="border border-gray-200 rounded-md bg-gray-50">
                <div className="border-b border-gray-200 p-4 flex justify-between items-center">
                  <div>
                    <span className="text-gray-500 text-sm font-medium mr-2">
                      Subject:
                    </span>
                    <span className="text-gray-900 font-medium">
                      {prContent.email.subject}
                    </span>
                  </div>
                  <Button
                    onClick={() => setIsEditingEmail(true)}
                    variant="outline"
                    size="sm"
                  >
                    <Edit3 className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                </div>
                <div className="p-4">
                  <div className="prose max-w-none">
                    <p className="text-gray-700 whitespace-pre-line leading-relaxed">
                      {prContent.email.body}
                    </p>
                  </div>
                  <SourceIndicator />
                </div>
              </div>
            )}
          </div>
        ) : (
          renderLoadingSkeleton()
        );

      case "publishing_pack":
        return prContent.publishingPack ? (
          <div className="space-y-4">
            {/* Fact-check reminder */}
            <div className="bg-blue-50 border-l-4 border-blue-300 p-4 rounded-r-md">
              <p className="text-blue-800 text-sm">
                <span className="font-medium">
                  This section prepares your article for AI and search
                  visibility. Replace all {"{{"} {"}}"} placeholders with your
                  actual details (URLs, dates, organisation name, etc.).
                </span>{" "}
                💡 You don’t need to understand the code — just copy and paste
                it or share it with your web or SEO team. It ensures your
                article is correctly indexed and discoverable by AI tools and
                search engines.
              </p>
            </div>

            <div className="prose max-w-none">
              <pre className="whitespace-pre-wrap text-gray-700 leading-relaxed bg-gray-50 p-4 rounded-md border border-gray-200 overflow-x-auto">
                {prContent.publishingPack}
              </pre>
            </div>
            <SourceIndicator />
          </div>
        ) : (
          renderLoadingSkeleton()
        );

      case "media-targets":
        // Only show if OUTREACH_UI feature flag is enabled
        const showOutreach = import.meta.env.VITE_OUTREACH_UI !== "false";
        return showOutreach ? <MediaTargetsTab articleId={articleId} /> : null;

      default:
        return null;
    }
  };

  // Get copy content for each section
  const getCopyContent = (sectionId: string) => {
    if (!prContent) return "";

    switch (sectionId) {
      case "summary":
        return prContent.summary || "";
      case "angles":
        return (
          prContent.angles
            ?.map((angle) => `${angle.headline}\n${angle.paragraph}\n`)
            .join("\n") || ""
        );
      case "outline":
        return prContent.outline?.join("\n") || "";
      case "article":
        return prContent.article
          ? `${prContent.article.title}\n\n${prContent.article.content}`
          : "";
      case "email":
        return prContent.email
          ? `Subject: ${prContent.email.subject}\n\n${prContent.email.body}`
          : "";
      case "publishing_pack":
        return prContent.publishingPack || "";
      default:
        return "";
    }
  };

  const sections = getAllSections();

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {sections.map((section, index) => {
        const isOpen = openSections.has(section.id);
        const hasContent =
          section.id === "media-targets" ||
          (prContent && getCopyContent(section.id));
        const IconComponent = section.icon;

        return (
          <Card
            key={section.id}
            className="border border-gray-200 rounded-md hover:border-gray-300 transition-colors duration-200"
          >
            <Collapsible
              open={isOpen}
              onOpenChange={() => toggleSection(section.id)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CollapsibleTrigger asChild>
                    <div className="flex items-center space-x-3 p-0 h-auto flex-1 justify-start cursor-pointer group">
                      <div className="flex items-center justify-center w-10 h-10 bg-gray-100 rounded-md">
                        <IconComponent className="h-5 w-5 text-gray-700" />
                      </div>
                      <div className="text-left">
                        <h2 className="text-lg font-medium text-gray-900 group-hover:text-gray-700 transition-colors">
                          {section.title}
                        </h2>
                        <p className="text-sm text-gray-600">
                          {section.description}
                        </p>
                      </div>
                      <div className="ml-auto">
                        {isOpen ? (
                          <ChevronDown className="h-5 w-5 text-gray-500" />
                        ) : (
                          <ChevronRight className="h-5 w-5 text-gray-500" />
                        )}
                      </div>
                    </div>
                  </CollapsibleTrigger>
                  {isOpen && hasContent && section.id !== "media-targets" && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="ml-2"
                      onClick={() =>
                        copyContent(getCopyContent(section.id), section.title)
                      }
                    >
                      <Copy className="h-4 w-4 mr-1" />
                      Copy
                    </Button>
                  )}
                </div>
              </CardHeader>

              <CollapsibleContent className="transition-all duration-300 ease-in-out">
                <CardContent className="pt-0">
                  {renderSectionContent(section.id)}
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        );
      })}

      {/* Back to Dashboard Button */}
      <div className="text-center pt-6">
        <Button
          variant="outline"
          onClick={() => window.history.back()}
          className="px-6 py-2"
        >
          Back to Dashboard
        </Button>
      </div>
    </div>
  );
}
