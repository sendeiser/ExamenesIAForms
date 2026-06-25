import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../ui/Button';
import { FileText, LogOut } from 'lucide-react';

export function Header() {
  const { user, logout } = useAuth();

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 font-bold text-xl text-brand-600">
          <FileText className="h-6 w-6" />
          Exámenes
        </Link>
        <div className="flex items-center gap-4">
          {user && (
            <>
              <span className="text-sm text-gray-600 hidden sm:block">{user.displayName || user.email}</span>
              <Button variant="ghost" onClick={logout}>
                <LogOut className="h-4 w-4" />
                Salir
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
