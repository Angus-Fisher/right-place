
import React from 'react';
import { SumUpConnection } from './SumUpConnection';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Banknote, Zap, Users } from 'lucide-react';

export const OpenBankingConnections = () => {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Connect Your Accounts</h1>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Connect your financial accounts to view all your transactions in one place. 
          Get a unified view of your finances across multiple platforms.
        </p>
      </div>

      {/* Features */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card className="text-center">
          <CardContent className="pt-6">
            <Users className="h-8 w-8 text-blue-600 mx-auto mb-2" />
            <h3 className="font-semibold mb-1">Easy Integration</h3>
            <p className="text-sm text-gray-600">Simple connection process with popular platforms</p>
          </CardContent>
        </Card>
        
        <Card className="text-center">
          <CardContent className="pt-6">
            <Zap className="h-8 w-8 text-green-600 mx-auto mb-2" />
            <h3 className="font-semibold mb-1">Real-Time Sync</h3>
            <p className="text-sm text-gray-600">Automatic transaction updates</p>
          </CardContent>
        </Card>
        
        <Card className="text-center">
          <CardContent className="pt-6">
            <Banknote className="h-8 w-8 text-purple-600 mx-auto mb-2" />
            <h3 className="font-semibold mb-1">All Your Accounts</h3>
            <p className="text-sm text-gray-600">Connect multiple payment providers</p>
          </CardContent>
        </Card>
      </div>

      {/* Connection Options */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <SumUpConnection />
        
        {/* Placeholder for future integrations */}
        <Card className="w-full max-w-md opacity-50">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <Banknote className="h-6 w-6 text-gray-400" />
            </div>
            <CardTitle className="text-gray-500">Stripe</CardTitle>
            <CardDescription>Coming Soon</CardDescription>
          </CardHeader>
        </Card>
        
        <Card className="w-full max-w-md opacity-50">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <Banknote className="h-6 w-6 text-gray-400" />
            </div>
            <CardTitle className="text-gray-500">PayPal</CardTitle>
            <CardDescription>Coming Soon</CardDescription>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
};
