"use client";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Liste mit Ziehgriff (Maus, Touch, Tastatur). onReorder erhält die neue ID-Reihenfolge. */
export function SortableList<T extends { id: string }>({
  items,
  renderItem,
  onReorder,
  disabled = false,
  className,
}: {
  items: T[];
  renderItem: (item: T) => ReactNode;
  onReorder: (ids: string[]) => void | Promise<void>;
  disabled?: boolean;
  className?: string;
}) {
  const [order, setOrder] = useState(items);
  const [prevItems, setPrevItems] = useState(items);
  if (items !== prevItems) {
    // Neue Daten vom Server übernehmen
    setPrevItems(items);
    setOrder(items);
  }
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = order.findIndex((i) => i.id === active.id);
    const newIndex = order.findIndex((i) => i.id === over.id);
    const next = arrayMove(order, oldIndex, newIndex);
    setOrder(next);
    void onReorder(next.map((i) => i.id));
  }

  if (disabled) {
    return (
      <ul className={className}>
        {order.map((item) => (
          <li key={item.id}>{renderItem(item)}</li>
        ))}
      </ul>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={order.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <ul className={className}>
          {order.map((item) => (
            <SortableRow key={item.id} id={item.id}>
              {renderItem(item)}
            </SortableRow>
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function SortableRow({ id, children }: { id: string; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("flex items-stretch gap-1", isDragging && "relative z-10 opacity-80 shadow-lg")}
    >
      <button
        type="button"
        className="flex cursor-grab touch-none items-center px-1 text-neutral-400 hover:text-neutral-700"
        aria-label="Verschieben"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>
      <div className="min-w-0 flex-1">{children}</div>
    </li>
  );
}
