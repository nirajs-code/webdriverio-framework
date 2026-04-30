/**
 * Builds a map of CSS attribute selectors for a given value.
 *
 * Usage:
 *   const by = selector('Save')
 *   await click(by.AriaLabel)          // [aria-label="Save"]
 *   await click(by.DataTestId)         // [data-testid="Save"]
 */
export const selector = (value: string) =>
    ({
        // ─── ARIA ──────────────────────────────────────────────────────────────────

        AriaCurrent: `[aria-current="${value}"]`,
        AriaControls: `[aria-controls="${value}"]`,
        AriaControlsContains: `[aria-controls*="${value}"]`,
        AriaDisabled: `[aria-disabled="${value}"]`,
        AriaExpanded: `[aria-expanded="${value}"]`,
        AriaHasPopup: `[aria-haspopup="${value}"]`,
        AriaHidden: `[aria-hidden="${value}"]`,
        AriaLabel: `[aria-label="${value}"]`,
        AriaLabelContains: `[aria-label*="${value}"]`,
        AriaLabelNotContains: `:not([aria-label*="${value}"])`,
        AriaLabelStartsWith: `[aria-label^="${value}"]`,
        AriaLabelEndsWith: `[aria-label$="${value}"]`,
        AriaLabeledBy: `[aria-labelledby="${value}"]`,
        AriaLabeledByContains: `[aria-labelledby*="${value}"]`,
        AriaPlaceholder: `[aria-placeholder="${value}"]`,
        AriaRequired: `[aria-required="${value}"]`,
        AriaSelected: `[aria-selected="${value}"]`,
        AriaSort: `[aria-sort="${value}"]`,

        // ─── Class ─────────────────────────────────────────────────────────────────

        Class: `[class="${value}"]`,
        ClassContainsValue: `[class*="${value}"]`,
        ClassStartsWith: `[class^="${value}"]`,
        ClassEndsWith: `[class$="${value}"]`,
        ClassWithInput: `[class="${value}"] input`,
        ClassWithButton: `[class="${value}"] button`,
        ClassWithSpan: `[class="${value}"] span`,

        // ─── Data attributes ───────────────────────────────────────────────────────

        DataAutomationId: `[data-automation-id="${value}"]`,
        DataComponent: `[data-component="${value}"]`,
        DataField: `[data-field="${value}"]`,
        DataId: `[data-id="${value}"]`,
        DataIndex: `[data-index="${value}"]`,
        DataKey: `[data-key="${value}"]`,
        DataName: `[data-name="${value}"]`,
        DataRole: `[data-role="${value}"]`,
        DataState: `[data-state="${value}"]`,
        DataTestId: `[data-testid="${value}"]`,
        DataType: `[data-type="${value}"]`,
        DataValue: `[data-value="${value}"]`,

        // ─── Standard HTML attributes ──────────────────────────────────────────────

        Alt: `[alt="${value}"]`,
        AltContains: `[alt*="${value}"]`,
        ForAttr: `[for="${value}"]`,
        Href: `[href="${value}"]`,
        HrefContains: `[href*="${value}"]`,
        HrefStartsWith: `[href^="${value}"]`,
        Id: `#${value}`,
        IdAttr: `[id="${value}"]`,
        Name: `[name="${value}"]`,
        NameContains: `[name*="${value}"]`,
        Placeholder: `[placeholder="${value}"]`,
        PlaceholderContains: `[placeholder*="${value}"]`,
        Role: `[role="${value}"]`,
        Src: `[src="${value}"]`,
        SrcContains: `[src*="${value}"]`,
        Title: `[title="${value}"]`,
        TitleContains: `[title*="${value}"]`,
        Type: `[type="${value}"]`,
        Value: `[value="${value}"]`,
        ValueContains: `[value*="${value}"]`,

        // ─── Element + attribute combos ────────────────────────────────────────────

        ButtonWithText: `button=${value}`,
        InputWithName: `input[name="${value}"]`,
        InputWithPlaceholder: `input[placeholder="${value}"]`,
        InputWithType: `input[type="${value}"]`,
        LinkWithText: `a=${value}`,
        LinkWithHref: `a[href="${value}"]`,
        SelectWithName: `select[name="${value}"]`,
        TextareaWithName: `textarea[name="${value}"]`,
    }) as const

export type SelectorMap = ReturnType<typeof selector>
