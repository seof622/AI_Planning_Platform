class PlanningError(Exception):
    """Base error for the planning workflow."""


class PlanningConfigurationError(PlanningError):
    """The AI provider is not configured."""


class PlanningProviderError(PlanningError):
    """The AI provider could not produce a usable response."""


class PlanningValidationError(PlanningError):
    """The generated plan violates the shared planning contract."""
