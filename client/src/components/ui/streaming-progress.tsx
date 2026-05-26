import React from 'react';
import { Clock, AlertCircle, CheckCircle, RotateCw, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface StreamingProgressProps {
  isConnected: boolean;
  connectionError: string | null;
  queueStatus: string | null;
  processingStatus: string | null;
  completedCount: number;
  totalExpected?: number;
  hasErrors: boolean;
  isPollingFallback?: boolean;
  onReconnect?: () => void;
  onCheckStatus?: () => void;
  className?: string;
}

const contentStages = [
  { key: 'summary', label: 'Summary', order: 1 },
  { key: 'angles', label: 'Angles', order: 2 },
  { key: 'outline', label: 'Outline', order: 3 },
  { key: 'email', label: 'Email', order: 4 },
  { key: 'article', label: 'Article', order: 5 }
];

export function StreamingProgress({
  isConnected,
  connectionError,
  queueStatus,
  processingStatus,
  completedCount,
  totalExpected = 5,
  hasErrors,
  isPollingFallback = false,
  onReconnect,
  onCheckStatus,
  className
}: StreamingProgressProps) {
  const progressPercentage = Math.round((completedCount / totalExpected) * 100);
  
  return (
    <Card className={cn("p-6 border-l-4", {
      "border-l-blue-500": isConnected && !hasErrors,
      "border-l-yellow-500": !isConnected || hasErrors,
      "border-l-red-500": connectionError
    }, className)}>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {connectionError ? (
              <AlertCircle className="h-5 w-5 text-red-500" />
            ) : hasErrors ? (
              <AlertCircle className="h-5 w-5 text-yellow-500" />
            ) : completedCount === totalExpected ? (
              <CheckCircle className="h-5 w-5 text-green-500" />
            ) : (
              <RotateCw className="h-5 w-5 text-blue-500 animate-spin" />
            )}
            <h3 className="font-semibold text-gray-900">
              {connectionError ? 'Connection Error' :
               completedCount === totalExpected ? 'Generation Complete' :
               'Generating Content'}
            </h3>
          </div>
          
          {/* Connection status */}
          <Badge variant={isConnected ? "default" : isPollingFallback ? "outline" : "secondary"} className="text-xs">
            {isConnected ? 'Connected' : isPollingFallback ? 'Checking Status' : 'Disconnected'}
          </Badge>
        </div>

        {/* Progress message */}
        <div className="text-sm text-gray-600">
          {connectionError ? (
            <div className="space-y-3">
              <p className="text-orange-600">{connectionError}</p>
              <div className="flex flex-col sm:flex-row gap-2">
                {onCheckStatus && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={onCheckStatus}
                    className="text-xs flex-1 sm:flex-none"
                  >
                    <RotateCw className="h-3 w-3 mr-1" />
                    Check Status
                  </Button>
                )}
                {onReconnect && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={onReconnect}
                    className="text-xs flex-1 sm:flex-none"
                  >
                    Reconnect
                  </Button>
                )}
              </div>
            </div>
          ) : isPollingFallback ? (
            <div className="flex items-center gap-2">
              <RotateCw className="h-4 w-4 animate-spin text-blue-500" />
              <span>Connection unstable - checking status automatically every 10 seconds</span>
            </div>
          ) : queueStatus ? (
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span>{queueStatus}</span>
            </div>
          ) : processingStatus ? (
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span>{processingStatus}</span>
            </div>
          ) : completedCount === totalExpected ? (
            <span className="text-green-600">All content generated successfully</span>
          ) : (
            <span>Grab a cuppa while our agent searches. This may take a few minutes.</span>
          )}
        </div>

        {/* Progress bar */}
        {!connectionError && (
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-gray-500">
              <span>Progress</span>
              <span>{completedCount}/{totalExpected} complete ({progressPercentage}%)</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className={cn("h-2 rounded-full transition-all duration-300", {
                  "bg-blue-500": !hasErrors,
                  "bg-yellow-500": hasErrors,
                  "bg-green-500": completedCount === totalExpected
                })}
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          </div>
        )}

        {/* Content stages (mobile-responsive) */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
          {contentStages.map((stage) => (
            <div 
              key={stage.key}
              className={cn("p-2 rounded border text-center", {
                "bg-green-50 border-green-200 text-green-700": completedCount >= stage.order,
                "bg-blue-50 border-blue-200 text-blue-700": 
                  processingStatus?.includes(stage.key) && completedCount < stage.order,
                "bg-muted border-border text-gray-500": completedCount < stage.order && !processingStatus?.includes(stage.key)
              })}
            >
              <div className="flex items-center justify-center gap-1">
                {completedCount >= stage.order ? (
                  <CheckCircle className="h-3 w-3" />
                ) : processingStatus?.includes(stage.key) ? (
                  <RotateCw className="h-3 w-3 animate-spin" />
                ) : (
                  <Clock className="h-3 w-3" />
                )}
                <span className="truncate">{stage.label}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Help text */}
        {!connectionError && completedCount < totalExpected && (
          <div className="text-xs text-gray-500 bg-muted p-3 rounded">
            <p>
              <strong>What's happening:</strong> We're generating personalized PR content for your article. 
              Each piece is crafted specifically for your company and industry.
            </p>
            {queueStatus && (
              <p className="mt-1">
                <strong>Queue:</strong> Multiple users may be generating content. You'll be processed fairly in turn.
              </p>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

/**
 * Compact version for mobile or inline use
 */
export function StreamingProgressCompact({
  isConnected,
  processingStatus,
  completedCount,
  totalExpected = 5,
  className
}: Pick<StreamingProgressProps, 'isConnected' | 'processingStatus' | 'completedCount' | 'className'> & { totalExpected?: number }) {
  const progressPercentage = Math.round((completedCount / totalExpected) * 100);
  
  return (
    <div className={cn("flex items-center gap-3 p-3 bg-muted rounded-lg", className)}>
      {completedCount === totalExpected ? (
        <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
      ) : (
        <RotateCw className="h-4 w-4 text-blue-500 animate-spin flex-shrink-0" />
      )}
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between text-sm mb-1">
          <span className="text-gray-700 truncate">
            {completedCount === totalExpected ? 'Complete' : 
             processingStatus || 'Generating content...'}
          </span>
          <span className="text-xs text-gray-500 ml-2">
            {completedCount}/{totalExpected}
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-1.5">
          <div 
            className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
      </div>
    </div>
  );
}