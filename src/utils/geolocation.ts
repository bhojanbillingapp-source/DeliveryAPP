import { Platform, PermissionsAndroid } from 'react-native';
import Geolocation from '@react-native-community/geolocation';

if (Platform.OS === 'android') {
  Geolocation.setRNConfiguration({ skipPermissionRequests: false, locationProvider: 'android' });
}

/**
 * Ask for foreground location permission.
 *  - Android: runtime ACCESS_FINE_LOCATION prompt.
 *  - iOS: Geolocation.requestAuthorization('whenInUse') — the result is
 *    actually inspected (previously this returned true unconditionally, so a
 *    denied user still hit "Waiting for location" forever).
 */
export async function requestLocationPermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION, {
      title: 'Location permission',
      message: 'Used to find restaurants near you and set your delivery address.',
      buttonPositive: 'Allow',
    });
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  }

  if (Platform.OS === 'ios') {
    return new Promise<boolean>((resolve) => {
      try {
        // RN Geolocation's iOS requestAuthorization takes success/error callbacks.
        (Geolocation as any).requestAuthorization(
          () => resolve(true),
          (err: any) => {
            // 'denied' | 'disabled' | 'restricted'
            resolve(!err || err === 'granted');
          },
        );
      } catch {
        resolve(false);
      }
    });
  }

  return true;
}

export function getCurrentCoords(): Promise<{ latitude: number; longitude: number }> {
  return new Promise((resolve, reject) => {
    Geolocation.getCurrentPosition(
      position => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
      () => {
        // High-accuracy GPS fix failed (common on emulators/indoors) — retry
        // with coarse/network-based location before giving up.
        Geolocation.getCurrentPosition(
          position => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
          error => reject(error),
          { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 }
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 10000 }
    );
  });
}
