import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';
import { DeliveryCard } from '../../components/DeliveryCard';
import type { AgentProfile, DeliveryJob } from '../../lib/types';

const POLL_INTERVAL_MS = 15_000;
const LOCATION_INTERVAL_MS = 20_000;
const ACTIVE = ['ASSIGNED', 'PICKED_UP', 'IN_TRANSIT'];

export function DeliveryHomePage() {
  const { user, refreshUser } = useAuth();
  const isAgent = user?.roles.some((r) => r.role === 'DELIVERY_AGENT') ?? false;

  // undefined = chargement, null = aucune candidature
  const [profile, setProfile] = useState<AgentProfile | null | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    try {
      const { data } = await api.get<AgentProfile>('/delivery/agents/me');
      setProfile(data);
      setLoadError(null);
    } catch (err: any) {
      if (err?.response?.status === 404) setProfile(null);
      else setLoadError('Impossible de charger votre profil livreur.');
    }
  }, []);

  useEffect(() => {
    // Le rôle DELIVERY_AGENT est attribué à l'approbation : on relit
    // l'utilisateur pour que la page reflète une approbation récente.
    void refreshUser();
    void loadProfile();
  }, []);

  if (loadError) return <div className="mx-auto max-w-2xl px-6 py-20 text-wax">{loadError}</div>;
  if (profile === undefined) return <div className="mx-auto max-w-2xl px-6 py-20 text-encre/50">Chargement…</div>;

  if (profile === null) return <ApplyForm onApplied={loadProfile} />;

  if (!isAgent) {
    return (
      <div className="mx-auto max-w-xl px-6 py-16">
        <h1 className="font-display text-3xl font-semibold">Candidature en cours d'examen</h1>
        <p className="mt-3 text-encre/70">
          Un administrateur doit valider votre pièce avant que vous puissiez recevoir des courses. Vous manipulerez
          de l'argent pour le compte de tiers, ce contrôle est donc obligatoire.
        </p>
        <Link
          to="/kyc"
          className="mt-6 inline-block bg-nuit text-brume font-medium px-6 py-2.5 hover:bg-nuit/90 transition-colors"
        >
          Envoyer ou suivre mon permis / ma pièce
        </Link>
      </div>
    );
  }

  return <Dashboard profile={profile} onProfileChanged={loadProfile} />;
}

function ApplyForm({ onApplied }: { onApplied: () => void }) {
  const [vehicleType, setVehicleType] = useState('moto');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post('/delivery/agents/apply', { vehicleType });
      onApplied();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Impossible d\'envoyer la candidature.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-6 py-16">
      <h1 className="font-display text-3xl font-semibold">Devenir livreur</h1>
      <p className="mt-2 text-encre/60">
        Recevez des courses près de vous et suivez vos gains. Votre candidature sera validée après
        vérification de votre pièce.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        <div>
          <label className="block text-sm font-medium mb-1.5" htmlFor="vehicle">
            Votre moyen de transport
          </label>
          <select
            id="vehicle"
            value={vehicleType}
            onChange={(e) => setVehicleType(e.target.value)}
            className="w-full border border-encre/20 px-4 py-2.5"
          >
            <option value="moto">Moto</option>
            <option value="velo">Vélo</option>
            <option value="voiture">Voiture</option>
            <option value="tricycle">Tricycle</option>
          </select>
        </div>

        {error && <p className="text-sm text-wax">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="w-full bg-nuit text-brume font-medium py-3 hover:bg-nuit/90 transition-colors disabled:opacity-60"
        >
          {busy ? 'Envoi…' : 'Envoyer ma candidature'}
        </button>
      </form>
    </div>
  );
}

function Dashboard({ profile, onProfileChanged }: { profile: AgentProfile; onProfileChanged: () => void }) {
  const [jobs, setJobs] = useState<DeliveryJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  const loadJobs = useCallback(() => {
    api
      .get<DeliveryJob[]>('/delivery/deliveries/mine')
      .then(({ data }) => setJobs(data))
      .finally(() => setLoading(false));
  }, []);

  function refreshAll() {
    loadJobs();
    onProfileChanged();
  }

  // Aucune notification en direct n'est encore envoyée au livreur : une course
  // qui lui est assignée apparaît donc via ce rafraîchissement périodique.
  useEffect(() => {
    loadJobs();
    const timer = window.setInterval(() => {
      loadJobs();
      onProfileChanged();
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [loadJobs, onProfileChanged]);

  // Un livreur disponible doit être localisable, sinon l'assignation
  // automatique ne peut jamais le choisir (elle ne retient que les positions connues).
  useEffect(() => {
    if (profile.status !== 'AVAILABLE') return;

    let lastSent = 0;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setGeoError(null);
        const now = Date.now();
        if (now - lastSent < LOCATION_INTERVAL_MS) return;
        lastSent = now;
        api
          .patch('/delivery/agents/me/location', { lat: pos.coords.latitude, lng: pos.coords.longitude })
          .catch(() => {});
      },
      () => setGeoError('Activez la géolocalisation : sans position, aucune course ne peut vous être proposée.'),
      { enableHighAccuracy: true },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [profile.status]);

  async function toggleAvailability() {
    setToggling(true);
    try {
      await api.patch('/delivery/agents/me/availability', {
        status: profile.status === 'AVAILABLE' ? 'OFFLINE' : 'AVAILABLE',
      });
      onProfileChanged();
    } finally {
      setToggling(false);
    }
  }

  const activeJobs = jobs.filter((j) => ACTIVE.includes(j.status));
  const pastJobs = jobs.filter((j) => !ACTIVE.includes(j.status));

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <div className="flex items-center justify-between gap-6 rounded-card border border-encre/10 bg-white p-5 shadow-xs">
        <div>
          <p className="text-sm text-encre/50">Votre statut</p>
          <p className="font-display text-xl font-semibold text-nuit">
            {profile.status === 'AVAILABLE' && 'Disponible'}
            {profile.status === 'BUSY' && 'En course'}
            {profile.status === 'OFFLINE' && 'Hors ligne'}
          </p>
        </div>
        <button
          onClick={toggleAvailability}
          disabled={toggling || profile.status === 'BUSY'}
          className={`text-sm font-display font-medium px-5 py-2.5 rounded-card transition-colors disabled:opacity-50 ${
            profile.status === 'AVAILABLE' ? 'border border-encre/30 hover:bg-encre/5 text-nuit' : 'bg-seve text-brume hover:bg-seve/90'
          }`}
        >
          {profile.status === 'AVAILABLE' ? 'Passer hors ligne' : 'Me rendre disponible'}
        </button>
      </div>

      {geoError && <p className="mt-3 text-sm text-wax">{geoError}</p>}

      <h2 className="mt-10 font-display text-2xl font-semibold">Courses en cours</h2>
      {loading ? (
        <p className="mt-4 text-encre/50">Chargement…</p>
      ) : activeJobs.length === 0 ? (
        <p className="mt-4 text-encre/50">
          {profile.status === 'AVAILABLE'
            ? "Aucune course pour l'instant. La prochaine assignée apparaîtra ici."
            : 'Passez en disponible pour recevoir des courses.'}
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          {activeJobs.map((job) => (
            <DeliveryCard key={job.id} job={job} onChanged={refreshAll} />
          ))}
        </div>
      )}

      {pastJobs.length > 0 && (
        <>
          <h2 className="mt-12 font-display text-2xl font-semibold">Historique</h2>
          <div className="mt-4 space-y-4">
            {pastJobs.map((job) => (
              <DeliveryCard key={job.id} job={job} onChanged={refreshAll} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
