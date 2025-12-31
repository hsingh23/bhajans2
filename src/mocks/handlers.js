import { http, HttpResponse, passthrough } from 'msw'

export const handlers = [
  // Handle Lottie files
  http.get('/*.lottie', () => {
    return passthrough()
  }),

  // Mocking the bhajan index fetch
  http.get('/bhajan-index2.json', () => {
    return passthrough()
  }),

  // Mock Firebase RTDB - paid user check
  http.get('https://bhajans-588f5.firebaseio.com/paid/*/expiresOn.json', () => {
    // Return valid expiry (1 year from now)
    return HttpResponse.json(Date.now() + 365 * 24 * 60 * 60 * 1000)
  }),

  // Mock Firebase RTDB - admin check
  http.get('https://bhajans-588f5.firebaseio.com/admin/*.json', () => {
    return HttpResponse.json(null) // Not an admin by default
  }),

  // Mock Firebase RTDB - favorites
  http.get('https://bhajans-588f5.firebaseio.com/favorites/*.json', () => {
    return HttpResponse.json({ 'Sample Bhajan': 1 })
  }),

  // Mock Firebase RTDB - satsang/presenter check
  http.get('https://bhajans-588f5.firebaseio.com/satsang/*.json', () => {
    return HttpResponse.json(null)
  }),

  // Mock Firebase RTDB writes (set)
  http.put('https://bhajans-588f5.firebaseio.com/favorites/*/*.json', () => {
    return HttpResponse.json({ success: true })
  }),

  // Mock Firebase RTDB deletes
  http.delete('https://bhajans-588f5.firebaseio.com/favorites/*/*.json', () => {
    return HttpResponse.json(null)
  }),
]

