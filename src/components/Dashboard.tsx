
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { AppHeader } from './AppHeader';
import { TransactionHistory } from './TransactionHistory';

export const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Financial Dashboard</h2>
          <p className="text-gray-600">Manage your finances with confidence</p>
        </div>

        {/* Welcome Message */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Welcome to Right Place</CardTitle>
            <CardDescription>
              Your secure open banking platform is ready to use
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">
              You've successfully logged into your Right Place dashboard. Here you can manage your financial accounts, 
              view transactions, and access various banking services securely.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-blue-50 rounded-lg">
                <h4 className="font-semibold text-blue-900 mb-2">Bank-Grade Security</h4>
                <p className="text-sm text-blue-700">
                  Your data is protected with the same level of security used by major financial institutions.
                </p>
              </div>
              <div className="p-4 bg-green-50 rounded-lg">
                <h4 className="font-semibold text-green-900 mb-2">Open Banking Ready</h4>
                <p className="text-sm text-green-700">
                  Connect and manage multiple bank accounts from different providers in one place.
                </p>
              </div>
            </div>
            
            <div className="mt-6">
              <Button 
                onClick={() => navigate('/connections')}
                className="flex items-center space-x-2"
              >
                <Link className="h-4 w-4" />
                <span>Connect Your Accounts</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Transaction History */}
        <TransactionHistory />
      </main>
    </div>
  );
};
