function SequenceCatalog({ sequences, activeId, activeMode, onSelect }) {
  return (
    <div className="sequence-list">
      {sequences.map((sequence) => {
        const isActive = activeMode === 'preset' && sequence.id === activeId

        return (
          <button
            key={sequence.id}
            type="button"
            className={`sequence-item ${isActive ? 'sequence-item--active' : ''}`}
            onClick={() => onSelect(sequence.id)}
          >
            <div className="sequence-item__head">
              <strong>{sequence.name}</strong>
              <span>{sequence.badge}</span>
            </div>
            <code>{sequence.shortFormula}</code>
            <p>{sequence.description}</p>
          </button>
        )
      })}
    </div>
  )
}

export default SequenceCatalog
