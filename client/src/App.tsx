import { Switch, Route, Redirect } from "wouter";
import { NavigationProgress } from "@/components/common/navigation-progress";
import { Toaster } from "@/components/ui/toaster";
import { SimpleAuthGuard } from "@/components/auth/simple-auth-guard";
import { ErrorBoundary } from "@/components/common/error-boundary";
import { Suspense, lazy } from "react";
import { Loader2 } from "lucide-react";
import { SmartRedirect } from "@/components/smart-redirect";

// Preload all main pages for instant navigation
const pageLoaders = {
  OnboardingPage: () => import("@/pages/onboarding-page"),
  DashboardPage: () => import("@/pages/dashboard-page"),
  AddArticlePage: () => import("@/pages/add-article-page"),
  FounderPostsPage: () => import("@/pages/founder-posts-page"),
  ResultsPage: () => import("@/pages/results-page"),
  HistoryPage: () => import("@/pages/history-page"),
  SettingsPage: () => import("@/pages/settings-page"),
  DocumentsPage: () => import("@/pages/DocumentsPage"),
  AdminPage: () => import("@/pages/admin-page")
};

// Start preloading components immediately for instant navigation
(() => {
  // Preload the most critical routes first
  pageLoaders.DashboardPage();
  pageLoaders.HistoryPage();
  pageLoaders.SettingsPage();
  pageLoaders.DocumentsPage();
  
  // Load the rest after a tiny delay
  setTimeout(() => {
    pageLoaders.AddArticlePage();
    pageLoaders.FounderPostsPage();
    pageLoaders.ResultsPage();
    pageLoaders.OnboardingPage();
  }, 100);
})();

// Create lazy components using the preloaded imports
const OnboardingPage = lazy(pageLoaders.OnboardingPage);
const DashboardPage = lazy(pageLoaders.DashboardPage);
const AddArticlePage = lazy(pageLoaders.AddArticlePage);
const FounderPostsPage = lazy(pageLoaders.FounderPostsPage);
const ResultsPage = lazy(pageLoaders.ResultsPage);
const HistoryPage = lazy(pageLoaders.HistoryPage);
const SettingsPage = lazy(pageLoaders.SettingsPage);
const DocumentsPage = lazy(pageLoaders.DocumentsPage);
const AdminPage = lazy(pageLoaders.AdminPage);

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );
}

function LazyRoute({ component: Component }: { component: React.ComponentType<any> }) {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Component />
    </Suspense>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <SimpleAuthGuard>
        <Toaster />
        <NavigationProgress />
        
        <Switch>
          <Route path="/onboarding">
            <LazyRoute component={OnboardingPage} />
          </Route>
          <Route path="/dashboard">
            <LazyRoute component={DashboardPage} />
          </Route>
          <Route path="/add-content">
            <LazyRoute component={AddArticlePage} />
          </Route>
          <Route path="/founder-posts">
            <LazyRoute component={FounderPostsPage} />
          </Route>
          <Route path="/results/:articleId">
            <LazyRoute component={ResultsPage} />
          </Route>
          <Route path="/history">
            <LazyRoute component={HistoryPage} />
          </Route>
          <Route path="/settings">
            <LazyRoute component={SettingsPage} />
          </Route>
          <Route path="/documents">
            <LazyRoute component={DocumentsPage} />
          </Route>
          <Route path="/admin">
            <LazyRoute component={AdminPage} />
          </Route>
          <Route path="/">
            <Redirect to="/dashboard" />
          </Route>
          <Route>
            <SmartRedirect />
          </Route>
        </Switch>
      </SimpleAuthGuard>
    </ErrorBoundary>
  );
}

export default App;
