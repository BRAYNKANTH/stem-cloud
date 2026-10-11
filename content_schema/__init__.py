"""The lesson content format (schema 2). See content_schema/lesson.py and docs/migration-plan-astro.md, section 3.3."""
from .lesson import Lesson, SCHEMA_VERSION

__all__ = ['Lesson', 'SCHEMA_VERSION']
