/**
 * Perfect negotiation helpers.
 * Lower peerId (lexicographic) is the polite peer and rolls back on glare.
 * The impolite (higher) peer is the offerer when a new pair forms.
 */

export function isPolitePeer(localPeerId: string, remotePeerId: string): boolean {
  return localPeerId < remotePeerId;
}

/** Impolite peer (higher id) creates the offer for a new pair. */
export function shouldCreateOffer(localPeerId: string, remotePeerId: string): boolean {
  return localPeerId > remotePeerId;
}
