import { SidebarNavSection } from '@/components/sidebar-nav';
import type { NavItem } from '@/types';

export function NavMain({ items = [] }: { items: NavItem[] }) {
    return (
        <SidebarNavSection
            label="Platform"
            items={items}
            className="px-2 py-0"
        />
    );
}
