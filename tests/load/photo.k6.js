// k6 load test: the photo server (staging, started with FOOD_AI=mock so it costs nothing).
//   k6 run -e URL=https://photo-staging.example.com/food-vision -e USERS=5000 tests/load/photo.k6.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import encoding from 'k6/encoding';
const USERS = +__ENV.USERS || 5000;
export const options = {
  scenarios: {
    lunch_rush: { executor: 'ramping-vus', stages: [{ duration: '1m', target: USERS }, { duration: '5m', target: USERS }, { duration: '1m', target: 0 }] },
  },
  thresholds: { http_req_failed: ['rate<0.01'], 'http_req_duration{expected_response:true}': ['p(95)<20000'] },
};
const catalogue = JSON.parse(open('./catalogue.json'));
export default function () {
  const image = 'data:image/jpeg;base64,' + encoding.b64encode(`vu${__VU}-${__ITER}-${Math.random()}`.repeat(400));
  let r = http.post(__ENV.URL, JSON.stringify({ image, hash: `${__VU}-${__ITER}-${Math.random()}`, samples: 'auto', catalogue }), { headers: { 'content-type': 'application/json' }, timeout: '90s' });
  if (r.status === 503) { sleep(+r.headers['Retry-After'] || 5); r = http.post(__ENV.URL, r.request.body, { headers: { 'content-type': 'application/json' }, timeout: '90s' }); }
  check(r, { 'photo read': x => x.status === 200 });
  sleep(300 + Math.random() * 600); // a photo every 5–15 minutes
}
