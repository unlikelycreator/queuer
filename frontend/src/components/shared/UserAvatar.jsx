import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { initials, cn } from '@/lib/utils';

const SIZES = {
  xs: 'h-5 w-5 text-[9px]',
  sm: 'h-6 w-6 text-[10px]',
  default: 'h-9 w-9 text-xs',
  lg: 'h-12 w-12 text-sm',
  xl: 'h-16 w-16 text-lg',
};

export function UserAvatar({ user, className, size = 'default', ring = false }) {
  const sizeClass = SIZES[size] || SIZES.default;
  if (!user) {
    return (
      <Avatar className={cn(sizeClass, className)} title="Unassigned">
        <AvatarFallback className="border border-dashed border-muted-foreground/40 bg-transparent text-muted-foreground">
          ?
        </AvatarFallback>
      </Avatar>
    );
  }
  return (
    <Avatar className={cn(sizeClass, ring && 'ring-2 ring-card', className)} title={user.name}>
      {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.name} referrerPolicy="no-referrer" />}
      <AvatarFallback style={{ backgroundColor: user.avatarColor || '#10b981', color: 'white' }} className="font-bold">
        {initials(user.name)}
      </AvatarFallback>
    </Avatar>
  );
}

export function AvatarStack({ users = [], max = 4, size = 'sm' }) {
  const shown = users.slice(0, max);
  const rest = users.length - shown.length;
  return (
    <div className="flex -space-x-1.5">
      {shown.map((u) => (
        <UserAvatar key={u._id} user={u} size={size} ring />
      ))}
      {rest > 0 && (
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-secondary text-[10px] font-semibold ring-2 ring-card">
          +{rest}
        </span>
      )}
    </div>
  );
}
