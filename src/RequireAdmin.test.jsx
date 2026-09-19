import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { RequireAdmin } from './util';

const mocks = vi.hoisted(() => ({ listener: null, get: vi.fn() }));
vi.mock('./firebase', () => ({
  auth: { currentUser: null, onAuthStateChanged: (listener) => {
    mocks.listener = listener;
    return () => {};
  } }, db: {},
}));
vi.mock('firebase/database', () => ({ ref: (_, path) => path, get: mocks.get }));
vi.mock('./Loader', () => ({ default: () => <p>Checking access</p> }));

beforeEach(() => { mocks.get.mockReset(); });
const renderRoute = () => render(
  <MemoryRouter initialEntries={['/admin']}>
    <Routes>
      <Route path='/admin' element={<RequireAdmin><p>Admin controls</p></RequireAdmin>} />
      <Route path='/' element={<p>Home redirect</p>} />
      <Route path='/login' element={<p>Login redirect</p>} />
    </Routes>
  </MemoryRouter>,
);

test('cold admin navigation waits for restored auth and the database role', async () => {
  let resolveRole;
  mocks.get.mockReturnValue(new Promise((resolve) => { resolveRole = resolve; }));
  renderRoute();
  await act(async () => mocks.listener({ uid: 'admin-a' }));
  expect(screen.queryByText('Home redirect')).not.toBeInTheDocument();
  expect(screen.getByText('Checking access')).toBeInTheDocument();
  await act(async () => resolveRole({ val: () => '1' }));
  expect(screen.getByText('Admin controls')).toBeInTheDocument();
});

test('a different signed-in user cannot inherit the previous admin role', async () => {
  mocks.get.mockResolvedValueOnce({ val: () => '1' });
  renderRoute();
  await act(async () => mocks.listener({ uid: 'admin-a' }));
  expect(screen.getByText('Admin controls')).toBeInTheDocument();
  let resolveRole;
  mocks.get.mockReturnValue(new Promise((resolve) => { resolveRole = resolve; }));
  await act(async () => mocks.listener({ uid: 'non-admin-b' }));
  expect(screen.queryByText('Admin controls')).not.toBeInTheDocument();
  await act(async () => resolveRole({ val: () => '0' }));
  expect(screen.getByText('Home redirect')).toBeInTheDocument();
});

test('a database failure is visible instead of being treated as no admin role', async () => {
  mocks.get.mockRejectedValue(new Error('offline'));
  renderRoute();
  await act(async () => mocks.listener({ uid: 'admin-a' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Unable to verify admin access');
});
