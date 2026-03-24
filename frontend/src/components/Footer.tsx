export interface FooterProps {
  entityCount: number;
  nodeCount: number;
  decisionCount: number;
}

export function Footer({ entityCount, nodeCount, decisionCount }: FooterProps) {
  return (
    <footer className="app-footer">
      <span className="app-footer__stat">
        <span className="app-footer__stat-label">Entities:</span>
        <span className="app-footer__stat-value">{entityCount}</span>
      </span>
      <span className="app-footer__stat">
        <span className="app-footer__stat-label">Nodes:</span>
        <span className="app-footer__stat-value">{nodeCount}</span>
      </span>
      <span className="app-footer__stat">
        <span className="app-footer__stat-label">Decisions:</span>
        <span className="app-footer__stat-value">{decisionCount}</span>
      </span>
    </footer>
  );
}
