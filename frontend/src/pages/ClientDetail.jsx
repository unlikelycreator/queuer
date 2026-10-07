import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, Mail, Phone, Globe, MapPin, Plus, FolderKanban, ExternalLink } from 'lucide-react';
import * as api from '@/api/endpoints';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ProjectStatusBadge, ClientStatusBadge } from '@/components/shared/Badges';
import { EmptyState } from '@/components/shared/Common';
import ProjectFormDialog from '@/components/shared/ProjectFormDialog';
import { formatDate } from '@/lib/utils';

export default function ClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);

  const load = () => {
    setLoading(true);
    api
      .getClient(id)
      .then((res) => setClient(res.data))
      .catch(() => toast.error('Client not found'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (!client) return null;

  return (
    <div className="animate-fade-in">
      <button onClick={() => navigate('/clients')} className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to clients
      </button>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-brand text-xl font-bold text-white shadow-soft">
            {client.name?.[0]?.toUpperCase()}
          </div>
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight">{client.name}</h1>
            <div className="mt-1 flex items-center gap-2">
              <ClientStatusBadge status={client.status} />
              {client.contactPerson && <span className="text-sm text-muted-foreground">{client.contactPerson}</span>}
            </div>
          </div>
        </div>
        <Button variant="gradient" onClick={() => setProjectDialogOpen(true)}>
          <Plus className="h-4 w-4" /> New Project
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 mb-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Contact information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {client.email && (
              <InfoRow icon={Mail} label={client.email} />
            )}
            {client.phone && <InfoRow icon={Phone} label={client.phone} />}
            {client.companyWebsite && <InfoRow icon={Globe} label={client.companyWebsite} />}
            {client.address && <InfoRow icon={MapPin} label={client.address} />}
            {!client.email && !client.phone && !client.companyWebsite && !client.address && (
              <p className="text-sm text-muted-foreground">No contact details added yet.</p>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{client.notes || 'No notes added yet.'}</p>
            <p className="mt-4 text-xs text-muted-foreground">Client since {formatDate(client.createdAt)}</p>
          </CardContent>
        </Card>
      </div>

      <h2 className="mb-3 text-lg font-semibold">Projects ({client.projects?.length || 0})</h2>
      {client.projects?.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="No projects yet"
          description="Create a project for this client to start tracking work."
          action={
            <Button variant="gradient" onClick={() => setProjectDialogOpen(true)}>
              <Plus className="h-4 w-4" /> New Project
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {client.projects.map((project) => (
            <Link key={project._id} to={`/projects/${project._id}`}>
              <Card className="hover:shadow-md transition-shadow h-full">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold truncate">{project.name}</p>
                    <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{project.description || 'No description'}</p>
                  <div className="mt-4">
                    <ProjectStatusBadge status={project.status} />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <ProjectFormDialog
        open={projectDialogOpen}
        onOpenChange={setProjectDialogOpen}
        defaultClientId={client._id}
        lockClient
        onSaved={load}
      />
    </div>
  );
}

function InfoRow({ icon: Icon, label }) {
  return (
    <p className="flex items-center gap-2.5 text-sm">
      <Icon className="h-4 w-4 text-muted-foreground shrink-0" /> {label}
    </p>
  );
}
