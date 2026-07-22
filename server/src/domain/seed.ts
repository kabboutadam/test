/**
 * Seed data. Identical to the mobile demo so both sides agree on ids. Replace
 * this module with a Postgres-backed repository (Prisma/TypeORM) later — the
 * services depend only on the shapes, not on where they come from.
 */

import { Bus, Child, Parent, Route, Subscription } from './types';

export const routes: Route[] = [
  {
    id: 'route_a',
    name: 'Route A — Achrafieh Morning',
    schoolId: 'sch_1',
    stops: [
      { id: 'a0', name: 'Sassine Square, Achrafieh', order: 0, location: { latitude: 33.8869, longitude: 35.5197 }, travelMinutesFromPrev: 0, scheduledTime: '06:50' },
      { id: 'a1', name: 'Mar Mikhael', order: 1, location: { latitude: 33.8959, longitude: 35.5225 }, travelMinutesFromPrev: 5, scheduledTime: '06:55' },
      { id: 'a2', name: 'Gemmayzeh, Rue Gouraud', order: 2, location: { latitude: 33.8955, longitude: 35.5155 }, travelMinutesFromPrev: 4, scheduledTime: '06:59' },
      { id: 'a3', name: 'Downtown, Martyrs Square', order: 3, location: { latitude: 33.8959, longitude: 35.5088 }, travelMinutesFromPrev: 5, scheduledTime: '07:04' },
      { id: 'a4', name: 'Bab Idriss', order: 4, location: { latitude: 33.8975, longitude: 35.5033 }, travelMinutesFromPrev: 4, scheduledTime: '07:08' },
      { id: 'a5', name: 'Wadi Abou Jamil', order: 5, location: { latitude: 33.8938, longitude: 35.4995 }, travelMinutesFromPrev: 4, scheduledTime: '07:12' },
      { id: 'a6', name: 'Beirut International College (School)', order: 6, location: { latitude: 33.8886, longitude: 35.4955 }, travelMinutesFromPrev: 6, scheduledTime: '07:18' },
    ],
  },
  {
    id: 'route_b',
    name: 'Route B — Hamra Morning',
    schoolId: 'sch_1',
    stops: [
      { id: 'b0', name: 'Manara Corniche', order: 0, location: { latitude: 33.8992, longitude: 35.4757 }, travelMinutesFromPrev: 0, scheduledTime: '06:55' },
      { id: 'b1', name: 'Hamra Street', order: 1, location: { latitude: 33.8967, longitude: 35.4808 }, travelMinutesFromPrev: 5, scheduledTime: '07:00' },
      { id: 'b2', name: 'Verdun, Dunes Center', order: 2, location: { latitude: 33.8865, longitude: 35.4823 }, travelMinutesFromPrev: 6, scheduledTime: '07:06' },
      { id: 'b3', name: 'UNESCO', order: 3, location: { latitude: 33.8797, longitude: 35.4859 }, travelMinutesFromPrev: 5, scheduledTime: '07:11' },
      { id: 'b4', name: 'Mathaf (National Museum)', order: 4, location: { latitude: 33.8776, longitude: 35.5153 }, travelMinutesFromPrev: 8, scheduledTime: '07:19' },
      { id: 'b5', name: 'Beirut International College (School)', order: 5, location: { latitude: 33.8886, longitude: 35.4955 }, travelMinutesFromPrev: 7, scheduledTime: '07:26' },
    ],
  },
];

export const buses: Bus[] = [
  { id: 'bus_a', plateNumber: 'B 123456', routeId: 'route_a', driverName: 'Elie Karam', driverPhone: '+961 3 000 111', capacity: 24 },
  { id: 'bus_b', plateNumber: 'B 654321', routeId: 'route_b', driverName: 'Rami Haddad', driverPhone: '+961 3 000 222', capacity: 24 },
];

export const parents: Parent[] = [
  { id: 'parent_1', name: 'Nour Khalil', email: 'nour.khalil@example.com', phone: '+961 3 555 777', childIds: ['child_1', 'child_2'] },
];

export const children: Child[] = [
  { id: 'child_1', name: 'Maya Khalil', grade: 'Grade 4', parentId: 'parent_1', routeId: 'route_a', stopId: 'a3', color: '#0B6E4F' },
  { id: 'child_2', name: 'Karim Khalil', grade: 'Grade 1', parentId: 'parent_1', routeId: 'route_b', stopId: 'b2', color: '#C1440E' },
];

export const subscriptions: Subscription[] = [
  { parentId: 'parent_1', status: 'trial', plan: null, renewsAt: '2026-08-04' },
];
