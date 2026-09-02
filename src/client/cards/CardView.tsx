import type { CardTemplateName } from "../../contract";
import { includedCardTemplates } from "./index";

/**
 * Renders a card's state with the component its card template names. The
 * template name binds schema and component together, so neither half can be
 * paired with the other's data.
 *
 * The read path parses a partial configuration, which does not run the card
 * state check `parseDashboardConfiguration` does, so state is validated here.
 * One card that does not fit its template says so where it sits rather than
 * taking the dashboard down with it.
 */
export function CardView<Name extends CardTemplateName>({
  template,
  state,
}: {
  template: Name;
  state: unknown;
}) {
  const { schema, Component } = includedCardTemplates[template];
  const data = schema.safeParse(state);

  return data.success ? (
    <Component data={data.data} />
  ) : (
    <p role="alert">This card's data does not fit its card template.</p>
  );
}
