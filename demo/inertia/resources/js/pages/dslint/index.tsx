import { Head } from '@inertiajs/react';
import { DashboardLayout, useWorkspaceReport } from 'dslinter';

export default function DslintGovernance() {
    const dslinterReport = useWorkspaceReport({
        reportUrl: '/dslinter-report.json',
        watchUrl: '/events',
    });

    return (
        <>
            <Head title="Governance" />
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <DashboardLayout
                    autoPlayground
                    dslinterReport={dslinterReport}
                />
            </div>
        </>
    );
}

DslintGovernance.layout = {
    breadcrumbs: [
        {
            title: 'Governance',
            href: '/governance',
        },
    ],
};
