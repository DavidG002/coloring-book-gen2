"use client";

import AppShell from "./AppShell";
import PublishConnectionsPanel from "./PublishConnectionsPanel";

// Split out of PrintBuilder — Publish (getting already-generated images live
// on a connected site) and Print (producing a physical print-ready product)
// are two different jobs for the user, and Publish is the one that's
// actually working today. PublishConnectionsPanel already carries its own
// "Publish." hero/header, so this page doesn't need a second one on top of it.
export default function PublishPage() {
  return (
    <AppShell active="Publish" breadcrumb="Publish">
      <PublishConnectionsPanel />
    </AppShell>
  );
}
