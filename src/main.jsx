import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import SynthRoute from './components/synth/SynthRoute.jsx'

// Hash routing rather than a router dependency: GitHub Pages serves this from
// a sub-path, and a hash route behaves the same in dev and in the build with
// no base-path handling. #/synth is the synth engine's regression harness and
// is deliberately unlinked from the Workbench UI.
function Root() {
  const [hash, setHash] = useState(() => window.location.hash)
  useEffect(() => {
    const onHash = () => setHash(window.location.hash)
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  return hash.startsWith('#/synth') ? <SynthRoute /> : <App />
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
