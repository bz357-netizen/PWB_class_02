import {
  PROCESS_STAGES,
  formatProcessTime,
  processDuration,
  processStageStart,
} from './worldProcess.js'

const TOTAL = processDuration()
const RATES = [0.25, 0.5, 1, 2]

export default function ProcessFilm({ params, stats, onPatch, onHide }) {
  const film = stats?.process
  const on = params.processOn === true
  const time = on ? film?.time ?? 0 : 0
  const total = film?.total ?? TOTAL
  const index = film?.index ?? 0
  const paused = params.processPaused === true
  const recording = params.processRecord === true || film?.recording === true
  const title = film?.title || PROCESS_STAGES[0].title
  const detail = film?.detail || 'Wire sphere first. Then land, color, sea, town, walker.'
  const step = film?.step ?? 1
  const steps = film?.steps ?? PROCESS_STAGES.length

  const start = (extra = {}) =>
    onPatch({
      processOn: true,
      processPaused: false,
      processSeek: { id: Date.now(), time: 0 },
      ...extra,
    })

  return (
    <aside className={`process-film${on ? ' is-on' : ''}${recording ? ' is-rec' : ''}`} aria-label="World process film">
      <div className="panel-head">
        <h2>Process</h2>
        <button type="button" className="panel-hide" onClick={onHide}>
          Hide
        </button>
      </div>
      <div className="process-film-copy">
        <p className="process-film-kicker">
          {recording ? 'REC' : 'Process'} · {step}/{steps} · {formatProcessTime(time)} / {formatProcessTime(total)}
        </p>
        <p className="process-film-title">{on ? title : 'How this world is made'}</p>
        <p className="process-film-detail">{on ? detail : 'Play the pipeline in order. Record a 3:30 pass for class.'}</p>
      </div>
      <div className="process-film-row">
        <button
          type="button"
          className={on ? 'is-on' : ''}
          onClick={() =>
            on
              ? onPatch({ processOn: false, processPaused: false, processRecord: false })
              : start()
          }
        >
          {on ? 'Stop' : 'Play process'}
        </button>
        <button
          type="button"
          disabled={!on}
          className={on && paused ? 'is-on' : ''}
          onClick={() => {
            if (!on) return
            if (film?.done && paused) start()
            else onPatch({ processPaused: !paused })
          }}
        >
          {paused ? 'Resume' : 'Pause'}
        </button>
        <button
          type="button"
          disabled={!on}
          onClick={() =>
            onPatch({
              processOn: true,
              processPaused: true,
              processSeek: { id: Date.now(), time: processStageStart(Math.max(0, index - 1)) },
            })
          }
        >
          Prev
        </button>
        <button
          type="button"
          disabled={!on}
          onClick={() =>
            onPatch({
              processOn: true,
              processPaused: true,
              processSeek: {
                id: Date.now(),
                time: processStageStart(Math.min(PROCESS_STAGES.length - 1, index + 1)),
              },
            })
          }
        >
          Next
        </button>
        <button
          type="button"
          className={recording ? 'is-on' : ''}
          onClick={() =>
            recording
              ? onPatch({ processRecord: false })
              : start({ processRecord: true })
          }
        >
          {recording ? 'Stop rec' : 'Record'}
        </button>
      </div>
      <label className="process-film-scrub">
        <span>Scrub</span>
        <input
          type="range"
          min={0}
          max={total}
          step={0.1}
          value={Math.min(time, total)}
          onChange={(event) =>
            onPatch({
              processOn: true,
              processPaused: true,
              processSeek: { id: Date.now(), time: Number(event.target.value) },
            })
          }
        />
      </label>
      <div className="process-film-rates" role="group" aria-label="Playback rate">
        {RATES.map((rate) => (
          <button
            key={rate}
            type="button"
            className={(params.processRate ?? 1) === rate ? 'is-on' : ''}
            onClick={() => onPatch({ processRate: rate })}
          >
            {rate}×
          </button>
        ))}
      </div>
    </aside>
  )
}
