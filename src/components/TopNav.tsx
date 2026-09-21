import { NavLink } from 'react-router-dom';
import { BookOpen, DoorOpen } from 'lucide-react';

export default function TopNav() {
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium transition-all duration-200 border ${
      isActive
        ? 'bg-ochre-500 text-paper-50 border-ochre-600 shadow-paper'
        : 'bg-paper-50/70 text-ink-700 border-paper-300 hover:bg-paper-100'
    }`;

  return (
    <div className="sticky top-0 z-40 -mt-2 pt-2 pb-2 backdrop-blur-md bg-paper-100/70 border-b border-paper-300/70">
      <div className="container max-w-6xl flex items-center justify-between gap-3">
        <NavLink to="/" className="font-hand text-xl text-ochre-600 shrink-0">
          旧房间
        </NavLink>
        <nav className="flex items-center gap-2">
          <NavLink to="/" end className={linkClass}>
            <BookOpen className="w-4 h-4" />
            气味档案
          </NavLink>
          <NavLink to="/relocation" className={linkClass}>
            <DoorOpen className="w-4 h-4" />
            搬迁归属台
          </NavLink>
        </nav>
      </div>
    </div>
  );
}
