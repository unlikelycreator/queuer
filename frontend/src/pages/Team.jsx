import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Copy, Link2, RefreshCw, MoreVertical, ShieldCheck, UserX, UserCheck, Trash2, Crown } from 'lucide-react';
import * as api from '@/api/endpoints';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { PageHeader, ConfirmDialog } from '@/components/shared/Common';
import { UserAvatar } from '@/components/shared/UserAvatar';

export default function Team() {
  const { user: me, refreshUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inviteCode, setInviteCode] = useState(me?.company?.inviteCode || '');
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'member' });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [transferTarget, setTransferTarget] = useState(null);
  const [transferring, setTransferring] = useState(false);

  const canManage = me?.role === 'owner' || me?.role === 'admin';

  const load = () => {
    setLoading(true);
    api
      .getUsers()
      .then((res) => setUsers(res.data))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const copyInvite = () => {
    navigator.clipboard.writeText(inviteCode);
    toast.success('Invite code copied');
  };

  const copyInviteLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/join?code=${inviteCode}`);
    toast.success('Invite link copied — teammates just need to fill in their details');
  };

  const regenerate = async () => {
    try {
      const res = await api.regenerateInviteCode();
      setInviteCode(res.data.inviteCode);
      toast.success('New invite code generated');
    } catch {
      toast.error('Failed to regenerate code');
    }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.createUser(form);
      toast.success('Team member added');
      setAddOpen(false);
      setForm({ name: '', email: '', password: '', role: 'member' });
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add user');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (u) => {
    try {
      await api.updateUser(u._id, { isActive: !u.isActive });
      toast.success(u.isActive ? 'User deactivated' : 'User activated');
      load();
    } catch {
      toast.error('Failed to update user');
    }
  };

  const changeRole = async (u, role) => {
    try {
      await api.updateUser(u._id, { role });
      toast.success('Role updated');
      load();
    } catch {
      toast.error('Failed to update role');
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.deleteUser(deleteTarget._id);
      toast.success('User removed');
      setDeleteTarget(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove user');
    } finally {
      setDeleting(false);
    }
  };

  const handleTransfer = async () => {
    setTransferring(true);
    try {
      await api.transferOwnership(transferTarget._id);
      toast.success(`Ownership transferred to ${transferTarget.name}`);
      setTransferTarget(null);
      await refreshUser();
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to transfer ownership');
    } finally {
      setTransferring(false);
    }
  };

  return (
    <div className="animate-fade-in">
      <PageHeader eyebrow="Organisation" title="Team" description="Manage who has access to your Queuer workspace">
        {canManage && (
          <Button variant="gradient" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" /> Add Member
          </Button>
        )}
      </PageHeader>

      {canManage && (
        <Card className="mb-6 border-dashed">
          <CardHeader>
            <CardTitle className="text-base">Invite code</CardTitle>
            <CardDescription>Share this code so teammates can join your company directly from the sign-up page.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <code className="rounded-lg bg-secondary px-4 py-2.5 font-mono text-lg font-semibold tracking-widest">
                {inviteCode}
              </code>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={copyInvite}>
                  <Copy className="h-3.5 w-3.5" /> Copy code
                </Button>
                <Button variant="outline" size="sm" onClick={copyInviteLink}>
                  <Link2 className="h-3.5 w-3.5" /> Copy invite link
                </Button>
                <Button variant="outline" size="sm" onClick={regenerate}>
                  <RefreshCw className="h-3.5 w-3.5" /> Regenerate
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {users.map((u) => (
                <div key={u._id} className="flex items-center gap-3 px-5 py-4">
                  <UserAvatar user={u} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium flex items-center gap-2">
                      {u.name} {u._id === me._id && <span className="text-xs text-muted-foreground">(you)</span>}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                  </div>
                  <Badge variant={u.role === 'owner' ? 'purple' : u.role === 'admin' ? 'info' : 'slate'} className="capitalize">
                    {u.role}
                  </Badge>
                  <Badge variant={u.isActive ? 'success' : 'slate'}>{u.isActive ? 'Active' : 'Inactive'}</Badge>

                  {canManage && u.role !== 'owner' && (
                    <DropdownMenu>
                      <DropdownMenuTrigger className="rounded-md p-1.5 hover:bg-secondary outline-none">
                        <MoreVertical className="h-4 w-4 text-muted-foreground" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {u.role === 'member' ? (
                          <DropdownMenuItem onClick={() => changeRole(u, 'admin')}>
                            <ShieldCheck className="mr-2 h-3.5 w-3.5" /> Make admin
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onClick={() => changeRole(u, 'member')}>
                            <ShieldCheck className="mr-2 h-3.5 w-3.5" /> Make member
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => toggleActive(u)}>
                          {u.isActive ? (
                            <>
                              <UserX className="mr-2 h-3.5 w-3.5" /> Deactivate
                            </>
                          ) : (
                            <>
                              <UserCheck className="mr-2 h-3.5 w-3.5" /> Activate
                            </>
                          )}
                        </DropdownMenuItem>
                        {me.role === 'owner' && u.isActive && (
                          <DropdownMenuItem onClick={() => setTransferTarget(u)}>
                            <Crown className="mr-2 h-3.5 w-3.5" /> Transfer ownership
                          </DropdownMenuItem>
                        )}
                        {me.role === 'owner' && (
                          <DropdownMenuItem onClick={() => setDeleteTarget(u)} className="text-destructive focus:text-destructive">
                            <Trash2 className="mr-2 h-3.5 w-3.5" /> Remove
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add team member</DialogTitle>
            <DialogDescription>Create an account for a new team member directly.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Full name</Label>
              <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Password</Label>
              <Input required type="password" minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button type="submit" variant="gradient" disabled={saving}>{saving ? 'Adding...' : 'Add member'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title="Remove this team member?"
        description={`${deleteTarget?.name} will lose access to the workspace immediately.`}
        onConfirm={handleDelete}
        loading={deleting}
      />

      <ConfirmDialog
        open={!!transferTarget}
        onOpenChange={(v) => !v && setTransferTarget(null)}
        title="Transfer ownership?"
        description={`${transferTarget?.name} will become the owner of this workspace, and you'll be moved to admin. This can only be undone by the new owner transferring it back.`}
        onConfirm={handleTransfer}
        confirmLabel="Transfer ownership"
        destructive={false}
        loading={transferring}
      />
    </div>
  );
}
