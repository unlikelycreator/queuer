import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { cn } from '@/lib/utils';

/** One input for a workspace custom field, matching its type. */
export default function CustomFieldInput({ field, value, onChange, className, compact }) {
  const h = compact ? 'h-8 text-xs' : '';
  switch (field.type) {
    case 'select':
      return (
        <Select value={value || '__none'} onValueChange={(v) => onChange(v === '__none' ? '' : v)}>
          <SelectTrigger className={cn(h, className)}>
            <SelectValue placeholder="Choose…" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none">—</SelectItem>
            {field.options.map((o) => (
              <SelectItem key={o} value={o}>
                {o}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    case 'checkbox':
      return <Switch checked={value === true || value === 'true'} onCheckedChange={onChange} />;
    case 'date':
      return <Input type="date" className={cn(h, className)} value={value || ''} onChange={(e) => onChange(e.target.value)} />;
    case 'number':
      return <Input type="number" className={cn(h, className)} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />;
    default:
      return (
        <Input
          type={field.type === 'url' ? 'url' : 'text'}
          className={cn(h, className)}
          value={value ?? ''}
          placeholder={field.type === 'url' ? 'https://…' : ''}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }
}

