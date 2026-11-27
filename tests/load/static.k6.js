// k6 load test: opening the app (the shell from the CDN).
//   k6 run -e URL=https://your-site.pages.dev/ -e USERS=5000 tests/load/static.k6.js
import http from 'k6/http';
import { check, sleep } from 'k6';
const USERS = +__ENV.USERS || 5000, BASE = __ENV.URL;
export const options = {
  scenarios: { spike: { executor: 'ramping-vus', stages: [{ duration: '30s', target: USERS }, { duration: '2m', target: USERS }, { duration: '30s', target: 0 }] } },
  thresholds: { http_req_failed: ['rate<0.01'], http_req_duration: ['p(95)<2000'] },
};
const FILES = ['', 'index.html', 'css/styles.css', 'js/app.js', 'js/food.js', 'js/nutrition.js', 'js/places-local.js', 'manifest.webmanifest'];
export default function () {
  const rs = http.batch(FILES.map(f => ['GET', BASE + f]));
  check(rs[0], { 'app opens': r => r.status === 200 });
  sleep(20 + Math.random() * 40);
}
