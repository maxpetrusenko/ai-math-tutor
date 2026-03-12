import React from "react";

type PageHeaderProps = {
  action?: React.ReactNode;
  badge?: string;
  subtitle: string;
  title: string;
};

export function PageHeader({ action, badge, subtitle, title }: PageHeaderProps) {
  return (
    <div className="page-header">
      <div>
        {badge ? <div className="page-header__eyebrow">{badge}</div> : null}
        <h1 className="page-header__title">{title}</h1>
        <p className="page-header__subtitle">{subtitle}</p>
      </div>
      {action ? <div className="page-header__action">{action}</div> : null}
    </div>
  );
}
