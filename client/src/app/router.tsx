import { Routes, Route } from 'react-router-dom';
import { Dashboard } from '../features/dashboard/Dashboard';
import { EndpointsPage } from '../features/endpoints/EndpointsPage';
import { EventsPage } from '../features/events/EventsPage';
import { DeliveriesPage } from '../features/deliveries/DeliveriesPage';
import { ReceiverPage } from '../features/receiver/ReceiverPage';

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/endpoints" element={<EndpointsPage />} />
      <Route path="/events" element={<EventsPage />} />
      <Route path="/deliveries" element={<DeliveriesPage />} />
      <Route path="/receiver" element={<ReceiverPage />} />
      <Route path="*" element={
        <div style={{ textAlign: 'center', padding: 60 }}>
          <h2 style={{ fontSize: '2rem', marginBottom: 8 }}>404</h2>
          <p style={{ color: 'var(--text-secondary)' }}>Page not found</p>
        </div>
      } />
    </Routes>
  );
}
