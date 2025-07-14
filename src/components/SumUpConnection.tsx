
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Building2, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export const SumUpConnection = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connected' | 'loading'>('disconnected');

  useEffect(() => {
    checkConnectionStatus();
  }, [user]);

  const checkConnectionStatus = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('user_tokens')
        .select('*')
        .eq('provider', 'sumup')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error checking connection status:', error);
        return;
      }

      if (data) {
        setIsConnected(true);
        setConnectionStatus('connected');
      } else {
        setIsConnected(false);
        setConnectionStatus('disconnected');
      }
    } catch (error) {
      console.error('Error checking connection status:', error);
    }
  };

  const initiateOAuth = async () => {
    setIsLoading(true);
    setConnectionStatus('loading');

    try {
      // Call the edge function to initiate OAuth
      const { data, error } = await supabase.functions.invoke('sumup-oauth-init', {
        body: { user_id: user?.id }
      });

      if (error) {
        console.error('OAuth initiation error:', error);
        toast({
          title: "Connection Error",
          description: "Failed to initiate SumUp connection. Please try again.",
          variant: "destructive",
        });
        setConnectionStatus('disconnected');
        return;
      }

      // Redirect to SumUp OAuth
      if (data?.authorization_url) {
        window.location.href = data.authorization_url;
      }
    } catch (error) {
      console.error('OAuth error:', error);
      toast({
        title: "Connection Error",
        description: "Failed to connect to SumUp. Please try again.",
        variant: "destructive",
      });
      setConnectionStatus('disconnected');
    } finally {
      setIsLoading(false);
    }
  };

  const disconnectSumUp = async () => {
    setIsLoading(true);
    
    try {
      const { error } = await supabase
        .from('user_tokens')
        .delete()
        .eq('provider', 'sumup')
        .eq('user_id', user?.id);

      if (error) {
        console.error('Disconnect error:', error);
        toast({
          title: "Disconnect Error",
          description: "Failed to disconnect SumUp. Please try again.",
          variant: "destructive",
        });
        return;
      }

      setIsConnected(false);
      setConnectionStatus('disconnected');
      toast({
        title: "Disconnected",
        description: "SumUp account has been disconnected successfully.",
      });
    } catch (error) {
      console.error('Disconnect error:', error);
      toast({
        title: "Disconnect Error",
        description: "Failed to disconnect SumUp. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const syncTransactions = async () => {
    setIsLoading(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('sumup-sync-transactions', {
        body: { user_id: user?.id }
      });

      if (error) {
        console.error('Sync error:', error);
        toast({
          title: "Sync Error",
          description: "Failed to sync transactions. Please try again.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Sync Complete",
        description: `Successfully synced ${data?.synced_count || 0} transactions.`,
      });
    } catch (error) {
      console.error('Sync error:', error);
      toast({
        title: "Sync Error",
        description: "Failed to sync transactions. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <div className="mx-auto w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
          <Building2 className="h-6 w-6 text-blue-600" />
        </div>
        <CardTitle className="flex items-center justify-center gap-2">
          SumUp Payments
          {connectionStatus === 'connected' && (
            <Badge variant="secondary" className="bg-green-100 text-green-800">
              <CheckCircle className="h-3 w-3 mr-1" />
              Connected
            </Badge>
          )}
          {connectionStatus === 'loading' && (
            <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              Connecting...
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Connect your SumUp account to view and manage your payment transactions
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isConnected ? (
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <h4 className="font-semibold text-blue-900 mb-2">What you'll get:</h4>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• View all your payment transactions</li>
                <li>• Automatic transaction syncing</li>
                <li>• Secure OAuth2 connection</li>
                <li>• Real-time payment updates</li>
              </ul>
            </div>
            <Button 
              onClick={initiateOAuth} 
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                'Connect SumUp Account'
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 bg-green-50 rounded-lg">
              <div className="flex items-center mb-2">
                <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
                <h4 className="font-semibold text-green-900">Account Connected</h4>
              </div>
              <p className="text-sm text-green-700">
                Your SumUp account is securely connected and ready to sync transactions.
              </p>
            </div>
            
            <div className="flex gap-2">
              <Button 
                onClick={syncTransactions} 
                disabled={isLoading}
                className="flex-1"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  'Sync Transactions'
                )}
              </Button>
              <Button 
                onClick={disconnectSumUp} 
                disabled={isLoading}
                variant="outline"
                className="flex-1"
              >
                Disconnect
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
