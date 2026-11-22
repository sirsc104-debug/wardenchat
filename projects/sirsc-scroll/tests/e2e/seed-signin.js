// Pretend a Warden Chat sign-in is saved, for the older catalog and review tests.
if (!localStorage.getItem('sirsc-scroll:session')) {
  localStorage.setItem('sirsc-scroll:session', JSON.stringify({ access_token: 'tok', refresh_token: 'ref', expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: 'u-test', username: 'tester' } }));
  if (!localStorage.getItem('sirsc-scroll:v1')) localStorage.setItem('sirsc-scroll:v1', JSON.stringify({ v: 2, accounts: { 'w:u-test': {} } }));
}
