import { api } from './api';

/**
 * Ouvre une pièce d'identité dans un nouvel onglet via une URL signée de 5 minutes, délivrée
 * par l'API (admin uniquement, consultation journalisée). Le document n'a pas d'adresse
 * publique : il n'existe aucun lien stable à partager.
 */
export async function openKycDocument(documentId: string): Promise<void> {
  // L'onglet est ouvert AVANT l'appel réseau : un onglet ouvert après un `await` n'est plus
  // rattaché au clic de l'utilisateur et se fait bloquer par les navigateurs.
  const tab = window.open('', '_blank');
  try {
    const { data } = await api.get<{ url: string }>(`/kyc/documents/${documentId}/file-url`);
    if (tab) {
      tab.opener = null; // l'onglet ouvert ne doit pas pouvoir agir sur notre page
      tab.location.href = data.url;
    }
  } catch (err) {
    tab?.close();
    throw err;
  }
}
