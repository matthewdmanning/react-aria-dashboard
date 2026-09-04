import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/**
 * PROTOTYPE — same three mock cards as the driven MCP session
 * (task list, 5-day calendar, shopping list), restyled using shadcn's
 * Card/Badge/Table composition and Tailwind utility classes for layout.
 */

const tasks = [
  { task: "Write project proposal", done: false },
  { task: "Review pull requests", done: true },
  { task: "Buy groceries", done: false },
  { task: "Call dentist", done: false },
  { task: "Pay electricity bill", done: true },
];

const events = [
  { day: "Mon", date: "Sep 7", title: "Team standup", time: "09:00" },
  { day: "Tue", date: "Sep 8", title: "Dentist appointment", time: "14:00" },
  { day: "Wed", date: "Sep 9", title: "Project deadline", time: "17:00" },
  { day: "Thu", date: "Sep 10", title: "Lunch with Sam", time: "12:30" },
  { day: "Fri", date: "Sep 11", title: "Weekly review", time: "16:00" },
];

const shopping = [
  { item: "Milk", note: "2%, 1 gallon", urgent: true },
  { item: "Eggs", note: "1 dozen", urgent: false },
  { item: "Bread", note: undefined, urgent: true },
  { item: "Bananas", note: "6", urgent: false },
  { item: "Coffee", note: undefined, urgent: true },
];

function TaskListCard() {
  const remaining = tasks.filter((t) => !t.done).length;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Task List <Badge>{remaining} left</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Done</TableHead>
              <TableHead>Task</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tasks.map(({ task, done }) => (
              <TableRow key={task}>
                <TableCell>
                  <Badge variant={done ? "default" : "secondary"}>
                    {done ? "done" : "open"}
                  </Badge>
                </TableCell>
                <TableCell
                  className={done ? "text-muted-foreground" : undefined}
                >
                  {done ? <s>{task}</s> : task}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function CalendarCard() {
  const today = "Wed";
  return (
    <Card>
      <CardHeader>
        <CardTitle>5-Day Calendar</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-5 gap-4">
        {events.map(({ day, date, title, time }) => (
          <Card
            key={day}
            className={day === today ? "border-primary" : undefined}
          >
            <CardContent className="flex flex-col gap-2">
              <Badge variant={day === today ? "default" : "secondary"}>
                {day} · {date}
              </Badge>
              <div>
                <p className="font-semibold">{title}</p>
                <p className="text-muted-foreground">{time}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </CardContent>
    </Card>
  );
}

function ShoppingListCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Shopping List</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-1">
          {shopping.map(({ item, note, urgent }) => (
            <li key={item}>
              <span className="font-semibold">{item}</span>
              {urgent ? (
                <>
                  {" "}
                  <Badge variant="destructive">urgent</Badge>
                </>
              ) : null}
              {note ? (
                <span className="text-muted-foreground"> — {note}</span>
              ) : null}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export function DashboardCardsPrototype() {
  return (
    <div className="flex flex-col gap-4 p-4">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <p className="text-muted-foreground">Welcome to your dashboard.</p>
      <TaskListCard />
      <CalendarCard />
      <ShoppingListCard />
    </div>
  );
}
