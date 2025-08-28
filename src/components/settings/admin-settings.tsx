"use client";

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { 
  Shield, 
  AlertTriangle, 
  Loader2, 
  TestTube,
  CheckCircle,
  XCircle,
  Clock,
  Users,
  Mail,
  Bell,
  AlertCircle,
  Activity,
  BarChart3,
  ChevronDown,
  ChevronRight,
  Send,
  Calendar,
  CalendarDays
} from 'lucide-react';

interface ComprehensiveCheckResult {
  success: boolean;
  timestamp: string;
  executionTime: number;
  overall: {
    totalUsersChecked: number;
    totalUsersProcessed: number;
    totalErrors: number;
    executionTime: number;
  };
  pushNotifications: any;
  emailDigests: any;
  logs: {
    success: string[];
    errors: string[];
    combined: string[];
  };
}

export function AdminSettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [emailTestLoading, setEmailTestLoading] = useState({
    daily: false,
    weekly: false,
    welcome: false,
    taskReminder: false,
    passwordReset: false,
    test: false,
    teamInvitation: false,
    shareNotification: false
  });
  const [testEmail, setTestEmail] = useState('');
  const [testResults, setTestResults] = useState<ComprehensiveCheckResult | null>(null);
  const [showDetails, setShowDetails] = useState({
    pushNotifications: false,
    emailDigests: false,
    logs: false,
    userDetails: false
  });

  const isAdmin = user?.email === "hamid.ijaz91@gmail.com";

  const handleAdminPost = async () => {
    setIsLoading(true);
    setTestResults(null);
    
    try {
      toast({ 
        title: "Running comprehensive check", 
        description: "Analyzing push notifications and email digests..." 
      });
      
      const res = await fetch("/api/notifications/comprehensive-check?mode=single", { 
        method: "POST",
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ testMode: true })
      });
      
      const responseData = await res.json();
      
      if (res.ok && responseData.success) {
        setTestResults(responseData.results);
        toast({ 
          title: "✅ Comprehensive check completed", 
          description: `Processed ${responseData.results.overall.totalUsersProcessed} users in ${responseData.results.overall.executionTime}ms`
        });
      } else {
        toast({ 
          title: "❌ Check failed", 
          description: responseData.error || "Check failed. Please try again.", 
          variant: "destructive" 
        });
      }
    } catch (error) {
      console.error('Admin check error:', error);
      toast({ 
        title: "Error", 
        description: "An error occurred during the comprehensive check.", 
        variant: "destructive" 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailTest = async (emailType: string, apiEndpoint: string) => {
    if (!testEmail.trim()) {
      toast({
        title: "Email required",
        description: "Please enter an email address to test with.",
        variant: "destructive"
      });
      return;
    }

    setEmailTestLoading(prev => ({ ...prev, [emailType]: true }));

    try {
      toast({
        title: `Sending ${emailType} email`,
        description: `Testing ${emailType} email to ${testEmail}...`
      });

      const res = await fetch(apiEndpoint, {
        method: "POST",
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          userEmail: testEmail,
          forceToday: true // For digest emails
        })
      });

      const responseData = await res.json();

      if (res.ok && responseData.success !== false) {
        toast({
          title: `✅ ${emailType} email sent`,
          description: `Successfully sent ${emailType} email to ${testEmail}`
        });
      } else {
        toast({
          title: `❌ ${emailType} email failed`,
          description: responseData.message || responseData.error || "Failed to send email",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error(`${emailType} email test error:`, error);
      toast({
        title: "Error",
        description: `An error occurred while sending ${emailType} email.`,
        variant: "destructive"
      });
    } finally {
      setEmailTestLoading(prev => ({ ...prev, [emailType]: false }));
    }
  };

  const formatExecutionTime = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'processed': return 'bg-green-500';
      case 'digests_sent': return 'bg-blue-500';
      case 'no_digests_due': return 'bg-gray-500';
      case 'skipped_disabled': return 'bg-yellow-500';
      case 'skipped_quiet_hours': return 'bg-orange-500';
      case 'skipped_no_subscriptions': return 'bg-gray-400';
      case 'error': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const renderResultsOverview = () => {
    if (!testResults) return null;

    const { overall, pushNotifications, emailDigests } = testResults;

    return (
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Comprehensive Check Results
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Overall Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="p-4">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-blue-500" />
                <div>
                  <div className="text-2xl font-bold">{overall.totalUsersProcessed}</div>
                  <div className="text-sm text-muted-foreground">Users Processed</div>
                </div>
              </div>
            </Card>
            
            <Card className="p-4">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-green-500" />
                <div>
                  <div className="text-2xl font-bold">{pushNotifications.totalNotificationsSent}</div>
                  <div className="text-sm text-muted-foreground">Push Notifications</div>
                </div>
              </div>
            </Card>
            
            <Card className="p-4">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-purple-500" />
                <div>
                  <div className="text-2xl font-bold">
                    {emailDigests.dailyDigestsSent + emailDigests.weeklyDigestsSent}
                  </div>
                  <div className="text-sm text-muted-foreground">Email Digests</div>
                </div>
              </div>
            </Card>
            
            <Card className="p-4">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-orange-500" />
                <div>
                  <div className="text-2xl font-bold">{formatExecutionTime(overall.executionTime)}</div>
                  <div className="text-sm text-muted-foreground">Execution Time</div>
                </div>
              </div>
            </Card>
          </div>

          {/* Success/Error Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold">Push Notifications</span>
                <Badge variant={pushNotifications.errors.length === 0 ? "default" : "destructive"}>
                  {pushNotifications.errors.length === 0 ? "Success" : `${pushNotifications.errors.length} Errors`}
                </Badge>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Overdue Alerts:</span>
                  <span>{pushNotifications.overdueNotifications}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Reminders:</span>
                  <span>{pushNotifications.reminderNotifications}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Subscriptions:</span>
                  <span>{pushNotifications.totalSubscriptionsProcessed}</span>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold">Email Digests</span>
                <Badge variant={emailDigests.emailErrors === 0 ? "default" : "destructive"}>
                  {emailDigests.emailErrors === 0 ? "Success" : `${emailDigests.emailErrors} Errors`}
                </Badge>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Daily Digests:</span>
                  <span>{emailDigests.dailyDigestsSent}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Weekly Digests:</span>
                  <span>{emailDigests.weeklyDigestsSent}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Success Rate:</span>
                  <span>{emailDigests.summary?.successRate || '0%'}</span>
                </div>
              </div>
            </Card>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderDetailedResults = () => {
    if (!testResults) return null;

    return (
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Detailed Results
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Push Notifications Details */}
          <div>
            <Button
              variant="ghost"
              onClick={() => setShowDetails(prev => ({ ...prev, pushNotifications: !prev.pushNotifications }))}
              className="w-full justify-between p-0 h-auto"
            >
              <span className="flex items-center gap-2">
                <Bell className="h-4 w-4" />
                Push Notifications Details ({testResults.pushNotifications.userDetails?.length || 0} users)
              </span>
              {showDetails.pushNotifications ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </Button>
            
            {showDetails.pushNotifications && (
              <div className="mt-3 space-y-2 pl-6">
                <ScrollArea className="h-64 w-full">
                  {testResults.pushNotifications.userDetails?.map((user: any, index: number) => (
                    <div key={index} className="border rounded p-3 mb-2">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-sm">{user.userEmail}</span>
                        <Badge className={getStatusColor(user.status)}>
                          {user.status}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                        <span>Tasks: {user.tasks?.total || 0}</span>
                        <span>Notifications: {user.notifications?.total || 0}</span>
                        <span>Subscriptions: {user.subscriptions?.total || 0}</span>
                      </div>
                      {user.logs?.length > 0 && (
                        <div className="mt-2 text-xs">
                          <div className="font-medium">Logs:</div>
                          {user.logs.slice(0, 3).map((log: string, logIndex: number) => (
                            <div key={logIndex} className="text-muted-foreground">• {log}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </ScrollArea>
              </div>
            )}
          </div>

          <Separator />

          {/* Email Digests Details */}
          <div>
            <Button
              variant="ghost"
              onClick={() => setShowDetails(prev => ({ ...prev, emailDigests: !prev.emailDigests }))}
              className="w-full justify-between p-0 h-auto"
            >
              <span className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Email Digests Details ({testResults.emailDigests.userDetails?.length || 0} users)
              </span>
              {showDetails.emailDigests ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </Button>
            
            {showDetails.emailDigests && (
              <div className="mt-3 space-y-2 pl-6">
                <ScrollArea className="h-64 w-full">
                  {testResults.emailDigests.userDetails?.map((user: any, index: number) => (
                    <div key={index} className="border rounded p-3 mb-2">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-sm">{user.userEmail}</span>
                        <Badge className={getStatusColor(user.status)}>
                          {user.status}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-muted-foreground">Daily: </span>
                          {user.digests?.daily?.shouldSend ? (
                            user.digests.daily.sent ? 
                              <Badge variant="default" className="text-xs">Sent</Badge> : 
                              <Badge variant="destructive" className="text-xs">Failed</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">Not Due</Badge>
                          )}
                        </div>
                        <div>
                          <span className="text-muted-foreground">Weekly: </span>
                          {user.digests?.weekly?.shouldSend ? (
                            user.digests.weekly.sent ? 
                              <Badge variant="default" className="text-xs">Sent</Badge> : 
                              <Badge variant="destructive" className="text-xs">Failed</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">Not Due</Badge>
                          )}
                        </div>
                      </div>
                      {user.logs?.length > 0 && (
                        <div className="mt-2 text-xs">
                          <div className="font-medium">Logs:</div>
                          {user.logs.slice(0, 3).map((log: string, logIndex: number) => (
                            <div key={logIndex} className="text-muted-foreground">• {log}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </ScrollArea>
              </div>
            )}
          </div>

          <Separator />

          {/* System Logs */}
          <div>
            <Button
              variant="ghost"
              onClick={() => setShowDetails(prev => ({ ...prev, logs: !prev.logs }))}
              className="w-full justify-between p-0 h-auto"
            >
              <span className="flex items-center gap-2">
                <Activity className="h-4 w-4" />
                System Logs ({testResults.logs.combined?.length || 0} entries)
              </span>
              {showDetails.logs ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </Button>
            
            {showDetails.logs && (
              <div className="mt-3 pl-6">
                <ScrollArea className="h-48 w-full">
                  <div className="space-y-1">
                    {testResults.logs.combined?.map((log: string, index: number) => (
                      <div 
                        key={index} 
                        className={`text-xs p-2 rounded ${
                          log.includes('ERROR') ? 'bg-red-50 text-red-700' : 
                          log.includes('[EMAIL]') ? 'bg-blue-50 text-blue-700' :
                          log.includes('[PUSH]') ? 'bg-green-50 text-green-700' :
                          'bg-gray-50 text-gray-700'
                        }`}
                      >
                        {log}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  if (!isAdmin) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <Alert>
          <Shield className="h-4 w-4" />
          <AlertDescription>
            You don't have permission to access admin tools.
          </AlertDescription>
        </Alert>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Admin tools can affect app functionality. Use with caution.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TestTube className="h-5 w-5" />
            System Tests
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button 
            onClick={handleAdminPost} 
            disabled={isLoading}
            variant="outline"
            className="w-full"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Running Comprehensive Check...
              </>
            ) : (
              <>
                <TestTube className="h-4 w-4 mr-2" />
                Run Comprehensive Check
              </>
            )}
          </Button>

          {testResults && (
            <div className="mt-4">
              <Alert 
                className={testResults.overall.totalErrors > 0 
                  ? "border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950" 
                  : "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950"
                }
              >
                {testResults.overall.totalErrors > 0 
                  ? <AlertCircle className="h-4 w-4" /> 
                  : <CheckCircle className="h-4 w-4" />
                }
                <AlertDescription>
                  <strong>Check completed:</strong> Processed {testResults.overall.totalUsersProcessed} users 
                  with {testResults.overall.totalErrors} errors in {formatExecutionTime(testResults.overall.executionTime)}
                </AlertDescription>
              </Alert>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Email Testing Tools */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Testing Tools
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Email Input Field */}
          <div className="space-y-2">
            <Label htmlFor="test-email">Test Email Address</Label>
            <Input
              id="test-email"
              type="email"
              placeholder="Enter email address (e.g., test@example.com)"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              className="w-full"
            />
            <div className="text-xs text-muted-foreground">
              Enter a valid email address to test email functionality
            </div>
          </div>

          <Separator />

          {/* Email Digest Tests */}
          <div className="space-y-2">
            <div className="text-sm font-medium text-muted-foreground">Email Digest Tests</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Button
                onClick={() => handleEmailTest('daily digest', '/api/email/daily-digest')}
                disabled={emailTestLoading.daily || !testEmail.trim()}
                variant="outline"
                className="w-full"
              >
                {emailTestLoading.daily ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sending Daily...
                  </>
                ) : (
                  <>
                    <Calendar className="h-4 w-4 mr-2" />
                    Send Daily Digest
                  </>
                )}
              </Button>

              <Button
                onClick={() => handleEmailTest('weekly digest', '/api/email/weekly-digest-enhanced')}
                disabled={emailTestLoading.weekly || !testEmail.trim()}
                variant="outline"
                className="w-full"
              >
                {emailTestLoading.weekly ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sending Weekly...
                  </>
                ) : (
                  <>
                    <CalendarDays className="h-4 w-4 mr-2" />
                    Send Weekly Digest
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Other Email Tests */}
          <Separator />
          <div className="text-sm font-medium text-muted-foreground mb-2">Additional Email Tests</div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            <Button
              onClick={() => handleEmailTest('welcome', '/api/email/welcome')}
              disabled={emailTestLoading.welcome || !testEmail.trim()}
              variant="outline"
              size="sm"
            >
              {emailTestLoading.welcome ? (
                <>
                  <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-3 w-3 mr-2" />
                  Welcome Email
                </>
              )}
            </Button>

            <Button
              onClick={() => handleEmailTest('task reminder', '/api/email/task-reminder')}
              disabled={emailTestLoading.taskReminder || !testEmail.trim()}
              variant="outline"
              size="sm"
            >
              {emailTestLoading.taskReminder ? (
                <>
                  <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Bell className="h-3 w-3 mr-2" />
                  Task Reminder
                </>
              )}
            </Button>

            <Button
              onClick={() => handleEmailTest('password reset', '/api/email/password-reset')}
              disabled={emailTestLoading.passwordReset || !testEmail.trim()}
              variant="outline"
              size="sm"
            >
              {emailTestLoading.passwordReset ? (
                <>
                  <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Shield className="h-3 w-3 mr-2" />
                  Password Reset
                </>
              )}
            </Button>

            <Button
              onClick={() => handleEmailTest('test', '/api/email/test')}
              disabled={emailTestLoading.test || !testEmail.trim()}
              variant="outline"
              size="sm"
            >
              {emailTestLoading.test ? (
                <>
                  <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <TestTube className="h-3 w-3 mr-2" />
                  Test Email
                </>
              )}
            </Button>

            <Button
              onClick={() => handleEmailTest('team invitation', '/api/email/team-invitation')}
              disabled={emailTestLoading.teamInvitation || !testEmail.trim()}
              variant="outline"
              size="sm"
            >
              {emailTestLoading.teamInvitation ? (
                <>
                  <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Users className="h-3 w-3 mr-2" />
                  Team Invite
                </>
              )}
            </Button>

            <Button
              onClick={() => handleEmailTest('share notification', '/api/email/share-notification')}
              disabled={emailTestLoading.shareNotification || !testEmail.trim()}
              variant="outline"
              size="sm"
            >
              {emailTestLoading.shareNotification ? (
                <>
                  <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-3 w-3 mr-2" />
                  Share Notify
                </>
              )}
            </Button>
          </div>

          <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="text-sm text-blue-800 dark:text-blue-200">
              <div className="font-medium mb-1">💡 Email Testing Guide</div>
              <ul className="text-xs space-y-1 text-blue-700 dark:text-blue-300">
                <li>• Enter a valid email address to receive test emails</li>
                <li>• Digest emails will be sent with current user data</li>
                <li>• Test emails help verify email templates and delivery</li>
                <li>• Check your inbox and spam folder for test emails</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results Display */}
      {testResults && (
        <>
          {renderResultsOverview()}
          {renderDetailedResults()}
        </>
      )}
    </motion.div>
  );
}
