import type { ComponentPropsWithoutRef } from 'react';
import { SidebarNavSection } from '@/components/sidebar-nav';
import { SidebarGroup } from '@/components/ui/sidebar';
import type { NavItem } from '@/types';

export function NavFooter({
    items,
    className,
    ...props
}: ComponentPropsWithoutRef<typeof SidebarGroup> & {
    items: NavItem[];
}) {
    return (
        <SidebarNavSection
            {...props}
            showLabel={false}
            items={items}
            buttonClassName="text-neutral-600 hover:text-neutral-800 dark:text-neutral-300 dark:hover:text-neutral-100"
            className={`group-data-[collapsible=icon]:p-0 ${className || ''}`}
        />
    );
}
