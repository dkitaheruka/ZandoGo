const EARTH_RADIUS_KM = 6371.0088;

export function haversineDistanceKm(
  latitudeFrom: number,
  longitudeFrom: number,
  latitudeTo: number,
  longitudeTo: number,
): number {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = toRadians(latitudeTo - latitudeFrom);
  const longitudeDelta = toRadians(longitudeTo - longitudeFrom);
  const fromLatitude = toRadians(latitudeFrom);
  const toLatitude = toRadians(latitudeTo);

  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitude) * Math.cos(toLatitude) * Math.sin(longitudeDelta / 2) ** 2;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(Math.min(1, haversine)));
}
