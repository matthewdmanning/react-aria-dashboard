/**
 * PROTOTYPE — throwaway. Answers one question: can a whole-widget card
 * template (an Eisenhower matrix — four quadrants, tasks draggable between
 * them and reorderable within one) be built by composing react-aria-components
 * alone, with no raw interactive HTML and no hooks outside the package?
 *
 * Every interactive/structural piece below is a react-aria-components export:
 * GridList, GridListItem, Heading, Text, Button, useDragAndDrop, useListData.
 * The only raw HTML is non-interactive layout <div>s positioning the four
 * quadrants in a 2x2 grid — react-aria-components ships no layout primitive,
 * so a bare container is unavoidable regardless of composition approach.
 *
 * Not reviewed, not a card template to copy from. See card design mode map.
 */
import {
  Button,
  GridList,
  GridListItem,
  Heading,
  Text,
  useDragAndDrop,
  useListData,
  isTextDropItem,
  type DragAndDropOptions,
} from "react-aria-components";

interface Task {
  id: string;
  label: string;
}

const seed: Record<string, Task[]> = {
  "do": [
    { id: "t1", label: "Fix production outage" },
    { id: "t2", label: "Reply to client escalation" },
  ],
  plan: [
    { id: "t3", label: "Design next quarter roadmap" },
    { id: "t4", label: "Learn the new build tool" },
  ],
  delegate: [{ id: "t5", label: "Schedule team standup" }],
  drop: [{ id: "t6", label: "Reorganize desktop icons" }],
};

const quadrants = [
  { key: "do", title: "Do — urgent & important" },
  { key: "plan", title: "Plan — important, not urgent" },
  { key: "delegate", title: "Delegate — urgent, not important" },
  { key: "drop", title: "Drop — neither" },
] as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- prototype, not typechecked (examples/ is outside tsconfig include)
type TaskList = any;

function Quadrant({
  quadrantKey,
  title,
  lists,
}: {
  quadrantKey: string;
  title: string;
  lists: Record<string, TaskList>;
}) {
  const list = lists[quadrantKey];

  const dragAndDrop: DragAndDropOptions = {
    getItems: (keys) =>
      [...keys].map((key) => ({
        "text/plain": list.getItem(key)?.label ?? "",
        task: JSON.stringify(list.getItem(key)),
      })),
    acceptedDragTypes: ["task"],
    getDropOperation: () => "move",
    onReorder(e) {
      if (e.target.dropPosition === "before") {
        list.moveBefore(e.target.key, e.keys);
      } else if (e.target.dropPosition === "after") {
        list.moveAfter(e.target.key, e.keys);
      }
    },
    async onInsert(e) {
      const items = await Promise.all(
        e.items
          .filter(isTextDropItem)
          .map(async (item) => JSON.parse(await item.getText("task")) as Task),
      );
      if (e.target.dropPosition === "before") {
        list.insertBefore(e.target.key, ...items);
      } else if (e.target.dropPosition === "after") {
        list.insertAfter(e.target.key, ...items);
      }
    },
    async onRootDrop(e) {
      const items = await Promise.all(
        e.items
          .filter(isTextDropItem)
          .map(async (item) => JSON.parse(await item.getText("task")) as Task),
      );
      list.append(...items);
    },
    onDragEnd(e) {
      if (e.dropOperation === "move" && !e.isInternal) {
        list.remove(...e.keys);
      }
    },
  };

  const { dragAndDropHooks } = useDragAndDrop(dragAndDrop);

  return (
    <div className="quadrant" data-quadrant={quadrantKey}>
      <Heading level={2}>{title}</Heading>
      <GridList
        aria-label={title}
        items={list.items}
        dragAndDropHooks={dragAndDropHooks}
        renderEmptyState={() => <Text>Nothing here — drop a task in.</Text>}
      >
        {(task) => (
          <GridListItem textValue={task.label}>
            <Button slot="drag">≡</Button>
            <Text>{task.label}</Text>
          </GridListItem>
        )}
      </GridList>
    </div>
  );
}

export function EisenhowerMatrix() {
  const lists = {
    "do": useListData({ initialItems: seed["do"] }),
    plan: useListData({ initialItems: seed.plan }),
    delegate: useListData({ initialItems: seed.delegate }),
    drop: useListData({ initialItems: seed.drop }),
  };

  return (
    <div className="matrix">
      <Heading level={1}>Eisenhower Matrix</Heading>
      <Button
        onPress={() => {
          for (const key of Object.keys(lists)) {
            const list = lists[key as keyof typeof lists];
            list.remove(...list.items.map((item) => item.id));
            for (const item of seed[key]) list.append(item);
          }
        }}
      >
        Reset
      </Button>
      <div className="grid">
        {quadrants.map(({ key, title }) => (
          <Quadrant key={key} quadrantKey={key} title={title} lists={lists} />
        ))}
      </div>
    </div>
  );
}
