
import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Building, LogOut, User, Link } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useNavigate, useLocation } from 'react-router-dom';

export const AppHeader = () => {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSignOut = async () => {
    const { error } = await signOut();
    if (error) {
      toast({
        title: "Error",
        description: "Failed to sign out. Please try again.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Signed out",
        description: "You've been signed out successfully.",
      });
      window.location.href = '/auth';
    }
  };

  const isCurrentPage = (path: string) => location.pathname === path;

  return (
    <header className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-600 p-2 rounded-lg">
              <Building className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-xl font-bold text-gray-900">Right Place</h1>
          </div>
          
          <div className="flex items-center space-x-4">
            <Button
              variant={isCurrentPage('/') ? 'default' : 'outline'}
              size="sm"
              onClick={() => navigate('/')}
              className="flex items-center space-x-2"
            >
              <span>Home</span>
            </Button>
            <Button
              variant={isCurrentPage('/connections') ? 'default' : 'outline'}
              size="sm"
              onClick={() => navigate('/connections')}
              className="flex items-center space-x-2"
            >
              <Link className="h-4 w-4" />
              <span>Connections</span>
            </Button>
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <User className="h-4 w-4" />
              <span>Welcome, {user?.email}</span>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleSignOut}
              className="flex items-center space-x-2"
            >
              <LogOut className="h-4 w-4" />
              <span>Sign Out</span>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
};
