import { useChannelRackStore } from '@/src/store/useChannelRackStore';
import { registerSynth, unregisterSynth } from '@/src/lib/pattern/PatternEngine';
import { ThreeOscEngine } from './ThreeOscEngine';
import { FMSynthEngine } from './FMSynthEngine';
import { SytrusEngine } from './SytrusEngine';
import { BooBassEngine } from './BooBassEngine';
import { PluckedEngine } from './PluckedEngine';
import { FlexRomplerEngine } from './FlexRomplerEngine';

export function syncSynths() {
  const state = useChannelRackStore.getState();
  
  const activeIds = new Set(state.channels.map(c => c.id));
  
  for (const channel of state.channels) {
    if (channel.type === 'instrument' && channel.instrumentType) {
      // Check if already registered (PatternEngine handles this implicitly but let's be safe)
      const existing = import('@/src/lib/pattern/PatternEngine').then(m => {
          if (!m.getSynth(channel.id)) {
              let synth;
              switch (channel.instrumentType) {
                  case 'threeOsc': synth = new ThreeOscEngine(); break;
                  case 'fmSynth': synth = new FMSynthEngine(); break;
                  case 'sytrus': synth = new SytrusEngine(); break;
                  case 'booBass': synth = new BooBassEngine(); break;
                  case 'plucked': synth = new PluckedEngine(); break;
                  case 'flex': synth = new FlexRomplerEngine(); break;
              }
              if (synth) m.registerSynth(channel.id, synth);
          }
      });
    }
  }

  // Cleanup deleted
  import('@/src/lib/pattern/PatternEngine').then(m => {
      m.cleanupSynths(activeIds);
  });
}
