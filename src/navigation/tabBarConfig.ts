export const TAB_BAR_HEIGHT = 56;
export const TAB_ROUTES = new Set(['Home', 'Categories', 'MyOrders', 'More']);

// Screens with their own sticky footer button (e.g. "Add new address",
// "Save Address", "Confirm this location") pinned to the bottom of the
// screen. The CartBar must float above that footer instead of overlapping
// it — height here is that footer's actual rendered height per screen.
export const FOOTER_HEIGHTS: Record<string, number> = {
  AddressList: 50,
  AddressForm: 50,
  MapPicker: 74,
};
export const FOOTER_ROUTES = new Set(Object.keys(FOOTER_HEIGHTS));

// Extra bottom clearance a tab screen's own content needs when the CartBar is
// showing, so the floating bar doesn't sit on top of buttons/list rows near
// the bottom of the screen. Covers the bar's own height plus the gap above it
// (see CartBar's `bottom` offset math) — independent of TAB_BAR_HEIGHT, since
// the tab bar itself already reserves its own space outside the content area.
export const CART_BAR_CLEARANCE = 80;
