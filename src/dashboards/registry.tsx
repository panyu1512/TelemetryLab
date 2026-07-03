import type { ComponentType } from "react";
import {
  Gauge,
  SlidersHorizontal,
  Fuel,
  Timer,
  Donut,
  Flag,
  ListOrdered,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { TelemetryData } from "../hooks/useTelemetry";
import { ClusterWidget } from "../components/widgets/ClusterWidget";
import { InputsWidget } from "../components/widgets/InputsWidget";
import { FuelWidget } from "../components/widgets/FuelWidget";
import { TimingWidget } from "../components/widgets/TimingWidget";
import { TyresWidget } from "../components/widgets/TyresWidget";
import { PositionWidget } from "../components/widgets/PositionWidget";
import { StandingsScreen } from "../components/standings/StandingsScreen";
import { RelativeScreen } from "../components/relative/RelativeScreen";
import { FuelStrategyScreen } from "../components/fuel/FuelStrategyScreen";

/** Relative footprint of a widget on the 12-column dashboard grid. */
export type WidgetSize = "sm" | "md" | "lg" | "xl";

/** Props every widget body receives. */
export interface WidgetBodyProps {
  data: TelemetryData | null;
}

export interface WidgetDef {
  id: string;
  title: string;
  /** One-line purpose, shown in the overlay manager. */
  description: string;
  icon: LucideIcon;
  defaultSize: WidgetSize;
  /** Optional explicit default footprint, overriding the size→{w,h} map. */
  defaultLayout?: { w: number; h: number };
  Component: ComponentType<WidgetBodyProps>;
}

export interface DashboardDef {
  id: string;
  label: string;
  icon: LucideIcon;
  /** False ⇒ planned but not built yet; renders a "coming soon" placeholder. */
  available: boolean;
  /** Roadmap milestone that ships this screen (for the placeholder copy). */
  milestone?: string;
  widgets: WidgetDef[];
  /**
   * A full-bleed screen that replaces the widget grid entirely (e.g. the
   * standings timing table). When set, `widgets` is ignored and the dashboard
   * is not a drag/resize grid.
   */
  Screen?: ComponentType;
}

export const DASHBOARDS: DashboardDef[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: Gauge,
    available: true,
    widgets: [
      {
        id: "cluster",
        title: "Speed · RPM · Gear",
        description: "Driving cluster: speed gauge, gear, RPM bar + shift light.",
        icon: Gauge,
        defaultSize: "lg",
        defaultLayout: { w: 6, h: 3 },
        Component: ClusterWidget,
      },
      {
        id: "inputs",
        title: "Inputs",
        description: "Throttle/brake trace, input bars and a steering indicator.",
        icon: SlidersHorizontal,
        defaultSize: "lg",
        defaultLayout: { w: 6, h: 3 },
        Component: InputsWidget,
      },
      {
        id: "fuel",
        title: "Fuel",
        description: "Tank level, percentage and a laps-remaining estimate.",
        icon: Fuel,
        defaultSize: "sm",
        Component: FuelWidget,
      },
      {
        id: "timing",
        title: "Lap timing",
        description: "Current, last and best lap with a delta vs best.",
        icon: Timer,
        defaultSize: "md",
        Component: TimingWidget,
      },
      {
        id: "tyres",
        title: "Tyre temps",
        description: "Per-corner temps on a heat scale, plus pressures.",
        icon: Donut,
        defaultSize: "md",
        defaultLayout: { w: 4, h: 3 },
        Component: TyresWidget,
      },
      {
        id: "position",
        title: "Position",
        description: "Race position and current lap.",
        icon: Flag,
        defaultSize: "sm",
        Component: PositionWidget,
      },
    ],
  },
  {
    id: "standings",
    label: "Standings",
    icon: ListOrdered,
    available: true,
    milestone: "v0.4.0",
    widgets: [],
    Screen: StandingsScreen,
  },
  {
    id: "relative",
    label: "Relative",
    icon: Users,
    available: true,
    milestone: "v0.5.0",
    widgets: [],
    Screen: RelativeScreen,
  },
  {
    id: "fuel",
    label: "Fuel Calc",
    icon: Fuel,
    available: true,
    milestone: "v0.8.0",
    widgets: [],
    Screen: FuelStrategyScreen,
  },
];

export function getDashboard(id: string): DashboardDef {
  return DASHBOARDS.find((d) => d.id === id) ?? DASHBOARDS[0];
}
